"use strict";

window.audio = (function() {
    let context = new AudioContext();
    let sampleRate = context.sampleRate;

    let metBuffer;
    let metSource;
    let metGain = context.createGain();
    metGain.connect(context.destination);
    let metVolume = 0.4;

    let micSource;
    let recorder;
    let dummy;
    let bufferSize = 8192;
    let data = [];
    let times = [];
    let recording = false;
    let callFinish = false;

    let startTime;
    let stopTime;

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
        let data = paddingBuffer.getChannelData(o);
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
        if (callFinish) {
            data.push(e.inputBuffer);
            times.push(context.currentTime);
            finish();
            callFinish = false;
            return;
        }


        if (recording) {
            data.push(e.inputBuffer);
            times.push(context.currentTime);
        } else {
            data = [e.inputBuffer];
            times = [context.currentTime];
        }
    };

    let record = function(start, CT) {
        startTime = start;
        recording = true;
    };
    let onstart = function() {
        console.log('record delay: ' + (performance.now() - startTime).toFixed(3));
    };

    let stop = function(stop, callback) {
        recording = true;
        callFinish = true;
        stopTime = stop;
    };

    let finish = function() {
        let length = stopTime - startTime;
        let frameCount = Math.ceil(length * sampleRate);

        let channels = micSource.channelCount;
        let buffer = context.createBuffer(channels, frameCount, sampleRate);

        for (let ch = 0; ch < channels; ch++) {
            let output = buffer.getChannelData(ch); 

            // get start & end times
            let startFrame = ((startTime - times[0]) * sampleRate)|0;
            let startBuffer = (startFrame / bufferSize)|0;
            let startIndex = startFrame % bufferSize;
            let stopFrame = ((stopTime - times[times.length - 1]) * sampleRate)|0;
            let stopBuffer = (stopFrame / bufferSize)|0;
            let stopIndex = stopFrame % bufferSize;

            let j = 0;

            let startData = data[startBuffer].getChannelData(ch);
            for (let i = startIndex; i < bufferSize; i++) {
                output[j++] = startData[i];
            }

            for (let buf = startBuffer + 1; buf < stopBuffer; buf++) {
                let bufData = data[buf].getChannelData(ch);
                for (let i = 0; i < bufferSize; i++) {
                    output[j++] = bufData[i];
                }
            }

            let stopData = data[stopBuffer].getChannelData(ch);
            for (let i = 0; i < stopIndex; i++) {
                output[j++] = stopData[i];
            }
        }

        let source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        let muter = context.createGain();
        muter.connext(context.destination);
        source.connect(muter);

        source.mute = function() {
            muter.gain.value = 0.0;
        };
        source.unmute = function() {
            muter.gain.value = 1.0;
        };
        source.destroy = function() {
            muter.disconnect(context.destination);
            source.disconnect(muter);
        };

        source.unmute();
        source.start(context.currentTime() - stopTime); // adjust for delay
    };

    return {
        initMet,
        initRecord,
        record,
        stop,
        time,
        metronome: {
            setTempo,
            start: startMetronome,
            stop: stopMetronome,
        },
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
