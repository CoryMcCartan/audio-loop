// METRONOME

"use strict";

window.audio = (function() {
    let channels = 1;
    let context = new AudioContext();
    let sampleRate = context.sampleRate;

    let metBuffer;
    let metSource;
    let metGain = context.createGain();
    metGain.connect(context.destination);
    let metVolume = 0.4;

    let recorder;
    let chunks = [];
    let callback;
    let startTime;
    let index;

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
        let paddingBuffer = context.createBuffer(channels, frameCount, sampleRate);
        for (let ch = 0; ch < channels; ch++) {
            let data = paddingBuffer.getChannelData(ch);
            data.set(metBuffer.getChannelData(ch)); // overwrite some of the silence with the click
        }
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
                recorder = new MediaRecorder(stream);
                recorder.onstop = finish;
                recorder.ondataavailable = e => chunks.push(e.data);
                resolve();
            }).catch(LOGF);
        });
    };

    let record = function(currentTime) {
        chunks = [];
        recorder.start();
        startTime = currentTime;
    };

    let stop = function(i, _callback) {
        recorder.stop();
        callback = _callback;
        index = i;
    };

    let finish = function() {
        let audio = document.createElement("audio");

        let blob = new Blob(chunks, {type: "audio/ogg; codecs=opus"});
        let dataURL = URL.createObjectURL(blob);
        audio.src = dataURL;

        let source = context.createMediaElementSource(audio);
        let channels = source.channelCount;
        
        source.mute = function() {
            audio.muted = true;
        };
        source.unmute = function() {
            audio.muted = false;
        };
        source.restart = function() {
            setTimeout(function() {
                audio.currentTime = 0;
                audio.play();
            }, 100 * index)
        };
        

        source.connect(context.destination);
        source.unmute();
        source.restart();

        callback(source); 
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
