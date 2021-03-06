"use strict";

window.audio = (function() {
    let context = new AudioContext();
    let sampleRate = context.sampleRate;

    let metBuffer;
    let metSource;
    let metGain = context.createGain();
    metGain.connect(context.destination);
    let metVolume = 0.4;

    let globalGain = context.createGain();
    globalGain.connect(context.destination);

    let reverb = new SimpleReverb(context, {
        seconds: 0.85,
        decay: 3,
    });
    let wetGain = context.createGain();
    let dryGain = context.createGain();
    let setReverb = r => wetGain.gain.value = r ? 1.0 : 0.0;
    reverb.connect(wetGain);
    wetGain.connect(globalGain);
    dryGain.connect(globalGain);

    let trebleEQ = context.createBiquadFilter();
    trebleEQ.type = "highshelf";
    trebleEQ.frequency.value = 2000; // Hz
    let bassEQ = context.createBiquadFilter();
    bassEQ.type = "lowshelf";
    bassEQ.frequency.value = 200; // Hz
    trebleEQ.connect(bassEQ);
    bassEQ.connect(reverb.input);
    bassEQ.connect(dryGain);

    let setTreble = g => trebleEQ.gain.value = g;
    let setBass = g => bassEQ.gain.value = g;


    let compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20; // db
    compressor.attack.value = 0.020; // s
    compressor.release.value = 0.200; // s
    compressor.ratio.value = 20.0; //
    compressor.knee.value = 5.0; // db
    compressor.connect(trebleEQ);


    let micSource;
    let recorder;
    let dummy;
    let bufferSize = 8192;
    let meter = 0;
    let data = [];
    let times = [];
    let recording = false;
    let callFinish = false;

    let startTime;
    let stopTime;
    let callback;

    let initMet = function() {
        return new Promise((resolve, reject) => {
            fetch("assets/met.wav")
            .then(r => r.arrayBuffer())
            .then(a => context.decodeAudioData(a))
            .then(b => {
                metBuffer = b;
                resolve();
            })
            .catch(reject);
        });
    };

    let setTempo = function(tempo = 60) {
        let frameCount = sampleRate * 60 / tempo;
        let paddingBuffer = context.createBuffer(1, frameCount, sampleRate);
        let data = paddingBuffer.getChannelData(0);
        data.set(metBuffer.getChannelData(0)); // overwrite some of the silence with the click

        if (metSource) metSource.disconnect(metGain);
        metSource = context.createBufferSource();
        metSource.loop = true;
        metSource.start();
        metSource.connect(metGain);
        metSource.buffer = paddingBuffer;
    };

    let startMetronome = function() {
        metGain.gain.value = metVolume;
    };
    let stopMetronome = function() { 
        metGain.gain.value = 0.0;
    };


    let time = () => context.currentTime;

    let mute = function(fade = false) {
        globalGain.gain.cancelScheduledValues(0);

        if (fade) {
            globalGain.gain.setTargetAtTime(0.0, context.currentTime, 0.10);
        } else {
            globalGain.gain.value = 0.0;
        }
    };
    let unmute = function(fade = false) {
        globalGain.gain.cancelScheduledValues(0);

        if (fade) {
            globalGain.gain.setTargetAtTime(1.0, context.currentTime, 0.03);
        } else {
            globalGain.gain.value = 1.0;
        }
    };


    let initRecord = function() {
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
                micSource = context.createMediaStreamSource(stream);
                dummy = context.createMediaStreamDestination();
                
                let ch = micSource.channelCount;
                recorder = context.createScriptProcessor(bufferSize, ch, ch);
                recorder.onaudioprocess = saveData;

                micSource.connect(recorder);
                recorder.connect(dummy);
                
                resolve();
            }).catch(LOGF);
        });
    };

    let saveData = function(e) {
        let channels = e.inputBuffer.numberOfChannels;
        let arr = new Array(channels);
        for (let ch = 0; ch < channels; ch++) {
            let data = new Float32Array(bufferSize);
            e.inputBuffer.copyFromChannel(data, ch);

            let avgValue = 0;
            const step = 500;
            for (let i = 0; i < bufferSize; i += step) {
                avgValue += Math.abs(data[i]);
            }
            meter = avgValue / (bufferSize / step);
            
            arr[ch] = data;
        }

        let offset = bufferSize / sampleRate;

        if (callFinish) {
            data.push(arr);
            times.push(context.currentTime - offset);
            callFinish = false;
            finish();
        }

        if (recording) {
            data.push(arr);
            times.push(context.currentTime - offset);
        } else {
            data = [arr];
            times = [context.currentTime - offset];
        }
    };

    let getMeter = () => meter;

    let record = function(start) {
        startTime = start;
        recording = true;

        metGain.gain.value /= 2;
        globalGain.gain.cancelScheduledValues(0);
        globalGain.gain.value = 0.5;
    };

    let stop = function(stop, _callback) {
        recording = false;
        callFinish = true;
        stopTime = stop;
        callback = _callback;
        
        metGain.gain.value *= 2;
        globalGain.gain.cancelScheduledValues(0);
        globalGain.gain.value = 1.0;
    }; 
    let finish = function() {
        let length = stopTime - startTime;
        let frameCount = Math.ceil(length * sampleRate);

        let channels = micSource.channelCount;
        let buffer = context.createBuffer(channels, frameCount, sampleRate);

        // get start & end times
        let startFrame = ((startTime - times[0]) * sampleRate)|0;
        let startBuffer = (startFrame / bufferSize)|0;
        let startIndex = startFrame % bufferSize;
        let stopFrame = startFrame + frameCount;
        let stopBuffer = (stopFrame / bufferSize)|0;
        let stopIndex = stopFrame % bufferSize;

        for (let ch = 0; ch < channels; ch++) {
            let offset = 0;

            let startData = data[startBuffer][ch].slice(startIndex);
            buffer.copyToChannel(startData, ch, offset);
            offset += bufferSize - startIndex;

            for (let buf = startBuffer + 1; buf < stopBuffer; buf++) {
                buffer.copyToChannel(data[buf][ch], ch, offset);
                offset += bufferSize;
            }

            if (stopBuffer >= data.length) continue;
            if (stopIndex === 0) continue; // no more data to copy
            let stopData = data[stopBuffer][ch].slice(0, stopIndex);
            buffer.copyToChannel(stopData, ch, offset);
            offset += stopIndex;
        }

        let source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        let sourceStartTime = startTime;

        let muter = context.createGain();
        muter.connect(compressor);
        source.connect(muter);

        source.mute = function() {
            muter.gain.value = 0.0;
        };
        source.unmute = function() {
            muter.gain.value = 1.0;
        };
        source.destroy = function() {
            muter.disconnect(compressor);
            source.disconnect(muter);
        };
        source.restart = function(time) {
            source.disconnect(muter);
            source = context.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(muter);
            sourceStartTime = context.currentTime;
            source.start(sourceStartTime, time);
        };
        source.export = function() {
            let wav = WAV.fromAudioBuffer(buffer);
            let blob = new Blob([wav], {type: "audio/wav"});
            return blob;
        };
        source.getTime = function() {
            return (context.currentTime - sourceStartTime) % length; 
        };

        source.unmute();
        let start = context.currentTime; 

        source.extraDelay = vm.latency / 1000;
        if (vm.tracks.length === 1) {
            source.extraDelay -= 0.01;

            if (!vm.playMetronome)
                source.extraDelay = 0.00;
        }

        let time = start - stopTime + source.extraDelay;
        if (time < 0) {
            time = 0;
            start += -time;
        }
        source.start(start, time); // adjust for delay

        callback(source); 
    };

    return {
        initialize: initRecord,
        record,
        stop,
        time,
        getMeter,
        metronome: {
            initialize: initMet,
            setTempo,
            start: startMetronome,
            stop: stopMetronome,
        },
        setTreble,
        setBass,
        setReverb,
        mute,
        unmute,
    };
})();

window.tempoFinder = (function() {
    const timeout = 2000;
    let times = [];
    let lastTime = false;

    return {
        tap: function() {
            let bpm;

            if (lastTime) {
                let difference = performance.now() - lastTime;
                if (difference > timeout) {
                    times = [];
                    lastTime = performance.now();
                    return;
                } else {
                    times.push(difference);
                }

                let average = times.reduce((p, c) => p + c) / times.length;
                bpm = 60 / (average / 1000);
            }
            
            lastTime = performance.now();
            return bpm;
        },
    }
})();
