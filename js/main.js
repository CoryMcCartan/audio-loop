/*
 * LOOPING SOFTWARE
 *
 * CORY McCARTAN
 */

"use strict";

function main() {
    window.vm = new Vue({
    el: "main",

    data: {
        quantize: true,
        playMetronome: false,
        maxTime: 20.0,
        playing: false,
        recording: false,
        delay: 0,
        currentTime: 0,
        base: null,
        tempo: null,
        tapColor: false,
        hasStartedMetronome: false,
        hasPressedRecord: false,
        hasPressedStop: false,

        tracks: [],
    },

    methods: {
        nextQuantization(callback) {
            if (!this.quantize || !this.base) {
                callback.call(this, audio.time());
                return;
            }

            let firstTrack = this.tracks[0];

            if (this.tempo && (!firstTrack || !firstTrack.end)) {
                let quantization = 60 / this.tempo;  // nearest beat
                let difference = audio.time() - this.base; 

                let frac = (difference / quantization) % 1; // frac part
                let time = quantization * (1 - frac); // ms until next point

                setTimeout(callback.bind(this, audio.time() + time), 1000*time);
            } else {
                if (!firstTrack || !firstTrack.end) {
                    callback.call(this, audio.time());
                    return;
                }

                let difference = firstTrack.length - firstTrack.audio.getTime();

                setTimeout(callback.bind(this, audio.time() + difference), 1000*difference);
            }
        },
        trackWidth(length) {
            if (length > this.maxTime) 
                this.maxTime = 1.25 * length;
            return 100 * length / this.maxTime + "%";   
        },
        deleteTrack(index) {
            if (this.tracks[index].audio) this.tracks[index].audio.destroy();
            this.tracks.splice(index, 1);
            if (this.tracks.length === 0) this.pause();
        },
        toggleMetronome() {
            this.playMetronome = !this.playMetronome;
            if (this.playMetronome && this.playing) {
                if (!this.hasStartedMetronome) audio.metronome.setTempo(this.tempo);
                audio.metronome.start();
                this.base = audio.time();
                this.hasStartedMetronome = true;
            } else if (!this.playMetronome && this.playing) {
                audio.metronome.stop();
            }
        },
        pause() {
            this.playing = false; 
            if (this.recording) this.stop();

            if (this.playMetronome && this.tempo) {
                audio.metronome.stop();
                this.hasStartedMetronome = false;
            }

            for (let track of this.tracks) {
                if (!track.muted) track.audio.mute();
            }
        },
        play() {
            this.playing = true; 
            let startTime = audio.time();

            //if (!this.base) 
                this.base = startTime;
            if (this.playMetronome) this.base += 0.001; // 1ms delay on met

            for (let track of this.tracks) {
                if (!track.end) continue;
                track.time = 0;
                track.audio.restart(track.audio.extraDelay);
            }

            let i = 0;
            let updateTime = () => {
                if (this.playing) requestAnimationFrame(updateTime);
                if (this.tracks.length === 0) return;

                let now = audio.time();
                this.currentTime = audio.time() - startTime;

                for (let track of this.tracks) {
                    if (!track.end) { // cursor just follows current time
                        if (!track.start)
                            track.time = 0;
                        else
                            track.time = track.length = audio.time() - track.start;
                    } else { // cursor synced
                        if (!track.audio) {
                            track.time = 0;
                            continue;
                        }
                        track.time = track.audio.getTime();
                    }
                }
            }
            requestAnimationFrame(updateTime);

            if (this.playMetronome && this.tempo) {
                audio.metronome.setTempo(this.tempo);
                audio.metronome.start();
                this.hasStartedMetronome = true;
            }

            for (let track of this.tracks)
                if (!track.muted && track.audio) track.audio.unmute();
        },
        record(oneUnitOnly) {
            if (this.hasPressedRecord) return;
            this.hasPressedRecord = true;
            // show blank track
            let index = this.tracks.push({
                start: 0,
                length: 0,
                time: 0,
                muted: false,
            }) - 1;
            setTimeout(componentHandler.upgradeDom, 0);

            this.nextQuantization(now => {
                this.recording = true;
                if (!this.playing) this.play();

                if (this.tracks.length === 1) this.base = now; 

                let track = this.tracks[index];
                track.start = now;

                audio.record(now);

                if (oneUnitOnly && this.quantize && this.tracks[0].end) {
                    setTimeout(this.stop.bind(this), 1000*this.tracks[0].length / 2); 
                }
            });
        },
        stop(immediate) {
            if (this.hasPressedStop) return;
            this.hasPressedStop = true;
            this.hasPressedRecord = false;

            this.nextQuantization(now => { 
                this.hasPressedStop = false;
                this.recording = false;
                
                let index = this.tracks.length - 1;
                let track = this.tracks[index];

                track.end = now;
                track.length = track.end - track.start;

                audio.stop(now, source => {
                    Vue.set(track, "audio", source);
                    track.time = audio.time() - track.end;
                });

                if (immediate) {
                    this.quantize = false;
                    this.record();
                    this.quantize = true;
                }
            });
        },
        tap() {
            if (this.playing) return;
            if (!this.tempo) this.playMetronome = true;
            this.tempo = tempoFinder.tap();
            //this.base = audio.time(); 
            console.log(this.tempo);

            this.tapColor = true;
            setTimeout(() => this.tapColor = false, 100);
        },
        muteTrack(index) {
            if (this.tracks.length <= index) return;

            let track = this.tracks[index];
            track.muted = !track.muted;
            if (track.muted)
                track.audio.mute();
            else
                track.audio.unmute();
        },
        download() {
            let zip = new JSZip();

            let n = this.tracks.length
            for (let i = 0; i < n; i++) {
                zip.file(`track-${i+1}.wav`, this.tracks[i].audio.export());
            }

            zip.generateAsync({type: "base64"}).then(data => {
                let link = document.createElement("a");
                link.href = "data:application/zip;base64," + data;
                link.download = "tracks.zip";
                link.click();
            });
        },
    }
    });

    Mousetrap.bind("space", () => vm.recording ? vm.stop() : vm.record());
    Mousetrap.bind("shift+space", () => vm.recording ? vm.stop() : vm.record(true));
    Mousetrap.bind("p", () => vm.playing ? vm.pause() : vm.play());
    Mousetrap.bind("t", vm.tap);
    Mousetrap.bind("d", () => vm.delay = (vm.delay + 1) % 5);
    Mousetrap.bind("q", () => vm.quantize = !vm.quantize);
    Mousetrap.bind("m", vm.toggleMetronome);
    for (let i = 0; i < 10; i++) {
        let key = ((i + 1) % 10).toString();
        Mousetrap.bind(key, vm.muteTrack.bind(vm, i));
        Mousetrap.bind("x " + key, vm.deleteTrack.bind(vm, i));
        Mousetrap.bind("shift+" + key, function() {
            vm.nextQuantization(vm.muteTrack.bind(vm, i));
        });
    }

    audio.initMet()
    .then(audio.initRecord())
    .then(() => {
        $("main").style.opacity = 1.0;
        screen.keepAwake = true;
    });
}

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("service-worker.js", {
        scope: location.pathname.replace("index.html", "")
    }).then(() => {
        console.log("Service Worker Registered.");
    })
}
