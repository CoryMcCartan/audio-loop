/*
 * LOOPING SOFTWARE
 *
 * CORY McCARTAN
 */

"use strict";

function main() {
    const r_delay = 85;

    window.vm = new Vue({
    el: "main",

    data: {
        quantize: true,
        playMetronome: false,
        maxTime: 20.0 * 1e3,
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
        nextQuantization(delay, callback) {
            if (!this.quantize || !this.base) return callback.call(this); 

            let firstTrack = this.tracks[0];

            if (this.tempo && (!firstTrack || !firstTrack.end)) {
                let quantization = (60 / this.tempo) * 1000;  // nearest beat
                let difference = performance.now() - this.base; 

                let frac = (difference / quantization) % 1; // frac part
                let time = quantization * (1 - frac); // ms until next point

                new Tock({
                    countdown: true,
                    complete: callback,
                }).start(time + delay);
            } else {
                if (!firstTrack && !firstTrack.end) 
                    return callback.call(this);

                let difference = firstTrack.length - firstTrack.time;
                new Tock({ countdown: true,
                    complete: callback,
                }).start(difference + delay);
            }
        },
        trackWidth(length) {
            if (length > this.maxTime) 
                this.maxTime = 1.25 * length;
            return 100 * length / this.maxTime + "%";   
        },
        deleteTrack(index) {
            if (!this.tracks[index].muted) this.tracks[index].audio.mute();
            this.tracks.splice(index, 1);
            if (this.tracks.length === 0) this.pause();
        },
        toggleMetronome() {
            this.playMetronome = !this.playMetronome;
            if (this.playMetronome && this.playing) {
                if (!this.hasStartedMetronome) audio.metronome.setTempo(this.tempo);
                audio.metronome.start();
                this.base = performance.now();
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

            for (let track of this.tracks)
                if (!track.muted) track.audio.mute();
        },
        play(delay = 0) {
            this.playing = true; 
            let startTime = performance.now() + delay;

            if (!this.base) this.base = startTime;
            if (this.playMetronome) this.base += 1; // 1ms delay on met

            for (let track of this.tracks) {
                if (!track.end) continue;
                track.time = 0;
                track.audio.restart(r_delay);
            }

            let i = 0;
            let updateTime = () => {
                if (this.playing) requestAnimationFrame(updateTime);
                if (this.tracks.length === 0) return;

                let now = performance.now();
                this.currentTime = now - startTime;
                let firstTrack = this.tracks[0];
                let newUnit = false;
                let unitLength = firstTrack.end ? firstTrack.length : Infinity;

                if (this.currentTime > unitLength) {
                    this.currentTime = 0;
                    startTime = now;
                    newUnit = true;
                }

                for (let track of this.tracks) {
                    if (!track.end) { // cursor just follows current time
                        if (!track.start) {
                            track.time = 0;
                        } else {
                            track.time = track.length = performance.now() - track.start;
                        }
                    } else { // cursor synced
                        if (newUnit) {
                            track.currentUnit++;
                            if (track.currentUnit >= track.units) {
                                track.currentUnit = 0;
                                track.audio.restart(r_delay);
                            }
                        }
                        track.time = track.currentUnit * unitLength + this.currentTime;
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
                currentUnit: 0,
                units: 1,
                muted: false,
            }) - 1;

            let delay = this.getRecordDelay(index);

            this.nextQuantization(-delay, () => {
                this.recording = true;
                if (!this.playing) this.play(-delay);

                let now = performance.now() + delay;
                if (this.tracks.length === 1) this.base = now; 

                let track = this.tracks[index];
                track.start = now;

                let currentTime;
                if (this.tracks[0].end)
                    currentTime = this.tracks[0].audio.mediaElement.currentTime * 1000;
                else
                    currentTime = 0;

                audio.record(track.start, currentTime);

                if (oneUnitOnly && this.quantize && this.tracks[0].end) {
                    setTimeout(this.stop.bind(this), this.tracks[0].length / 2); 
                }
            });
        },
        stop(immediate) {
            if (this.hasPressedStop) return;
            this.hasPressedStop = true;
            this.hasPressedRecord = false;
            let delay = 1.3;

            this.nextQuantization(-delay, () => { // 1.5ms stop delay
                this.hasPressedStop = false;
                this.recording = false;

                let index = this.tracks.length - 1;
                let track = this.tracks[index];

                track.end = performance.now() + delay;
                track.length = track.end - track.start;

                let base = this.tracks[0].length;
                track.units = track.length / base;
                if (this.quantize) track.units = Math.round(track.units);
                track.length = track.units * base;

                audio.stop(track.end, source => {
                    Vue.set(track, "audio", source);
                    source.restart(r_delay);
                    track.time = 0;
                    track.currentUnit = 0;

                    if (immediate) {
                        this.quantize = false;
                        this.record();
                        this.quantize = true;
                    }
                });
            });
        },
        getRecordDelay(index) {
            if (index === 0) {
                if (this.tempo)
                    return -0.3;
                else
                    return 10.0;
            } else {
                if (this.quantize)
                    return 0.3;
                else
                    return 2.5;
            }
        },
        tap() {
            if (this.playing) return;
            if (!this.tempo) this.playMetronome = true;
            this.tempo = tempoFinder.tap();
            this.base = performance.now(); 
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
                zip.file(`track-${i+1}.opus`, this.tracks[i].audio.blob);
            }

            zip.generateAsync({type: "base64"}).then(data => {
                location.href = "data:application/zip;base64," + data;
            });
        },
    }
    });

    Mousetrap.bind("space", () => vm.recording ? vm.stop() : vm.record());
    Mousetrap.bind("shift+space", () => vm.recording ? vm.stop(true) : vm.record(true));
    Mousetrap.bind("p", () => vm.playing ? vm.pause() : vm.play());
    Mousetrap.bind("t", vm.tap);
    Mousetrap.bind("d", () => vm.delay = (vm.delay + 1) % 5);
    Mousetrap.bind("q", () => vm.quantize = !vm.quantize);
    Mousetrap.bind("m", vm.toggleMetronome);
    Mousetrap.bind("1", vm.muteTrack.bind(vm, 0));
    Mousetrap.bind("2", vm.muteTrack.bind(vm, 1));
    Mousetrap.bind("3", vm.muteTrack.bind(vm, 2));
    Mousetrap.bind("4", vm.muteTrack.bind(vm, 3));
    Mousetrap.bind("5", vm.muteTrack.bind(vm, 4));
    Mousetrap.bind("6", vm.muteTrack.bind(vm, 5));
    Mousetrap.bind("7", vm.muteTrack.bind(vm, 6));
    Mousetrap.bind("8", vm.muteTrack.bind(vm, 7));
    Mousetrap.bind("9", vm.muteTrack.bind(vm, 8));
    Mousetrap.bind("0", vm.muteTrack.bind(vm, 9));
    Mousetrap.bind("x 1", vm.deleteTrack.bind(vm, 0));
    Mousetrap.bind("x 2", vm.deleteTrack.bind(vm, 1));
    Mousetrap.bind("x 3", vm.deleteTrack.bind(vm, 2));
    Mousetrap.bind("x 4", vm.deleteTrack.bind(vm, 3));
    Mousetrap.bind("x 5", vm.deleteTrack.bind(vm, 4));
    Mousetrap.bind("x 6", vm.deleteTrack.bind(vm, 5));
    Mousetrap.bind("x 7", vm.deleteTrack.bind(vm, 6));
    Mousetrap.bind("x 8", vm.deleteTrack.bind(vm, 7));
    Mousetrap.bind("x 9", vm.deleteTrack.bind(vm, 8));
    Mousetrap.bind("x 0", vm.deleteTrack.bind(vm, 9));

    audio.initMet()
    .then(audio.initRecord())
    .then(() => {
        $("main").style.opacity = 1.0;
    });
}

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("service-worker.js", {
        scope: location.pathname.replace("index.html", "")
    }).then(() => {
        console.log("Service Worker Registered.");
    })
}
