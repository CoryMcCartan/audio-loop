/*
 * LOOPING SOFTWARE
 *
 * CORY McCARTAN
 */

"use strict";

function main() {
    let timeoutID;

    window.vm = new Vue({
        el: "main",

        data: {
            quantize: true,
            playMetronome: true,
            maxTime: 20.0 * 1e3,
            playing: false,
            recording: false,
            delay: 0,
            active: -1,
            base: null,
            tempo: null,
            startTime: 0,

            tracks: [],
        },

        computed: {
            currentTime: function() {
                if (!this.startTime) return 0;
                else return performance.now() - this.startTime;
            },
        },

        methods: {
            nextQuantization: function(callback) {
                if (!this.quantize || !this.base 
                    || (!this.tempo && (!this.tracks[0] || !this.tracks[0].end))) 
                    return callback.call(this); // not enough info for quantization

                let difference = Date.now() - this.base; 
                let quantization = this.tempo ? 
                        (60 / this.tempo) * 1000 :  // nearest beat
                        this.tracks[0].length; // or length of first loop

                // if there's a tempo and a completed first track
                if (this.tempo && this.tracks[0] && this.tracks[0].end) {
                    let beatsPerTrack = this.tracks[0].length / quantization;
                    quantization *= Math.round(beatsPerTrack);
                }

                let steps = (difference / quantization) % 1; // frac part
                let time = quantization * (1 - steps); // ms until next point
                if (callback) {
                    timeoutID = setTimeout(callback, time);
                }
                

                return time;
            },
            trackWidth: function(length) {
                if (length > this.maxTime) 
                    this.maxTime = 1.25 * length;
                return 100 * length / this.maxTime + "%";   
            },
            deleteTrack: function(index) {
                this.tracks.splice(index, 1);
            },
            pause: function() {
                // TODO check quantization

                this.playing = false; 
                if (this.recording) this.stop();
                // TODO stop all audio
            },
            play: function() {
                // TODO check delay
                this.playing = true; 
                // TODO start met if needed
            },
            record: function() {
                // show blank track
                let index = this.tracks.push({
                    start: 0,
                    length: 0,
                    muted: false,
                }) - 1;

                this.nextQuantization(() => {
                    this.recording = true;
                    if (!this.playing) this.play();

                    if (this.tracks.length === 1) this.base = Date.now(); 
                    this.tracks[index].start = Date.now();

                    // update length
                    let updateLength = () => {
                        let track = this.tracks[index];
                        track.length = Date.now() - track.start;
                        if (!track.end)
                            requestAnimationFrame(updateLength);
                    };
                    requestAnimationFrame(updateLength);

                    // TODO check delay
                    if (this.delay) {
                        let step = 1000;
                        if (this.tempo) step = 1000 * (60 / tempo);

                        setTimeout(function() {
                             
                        }, step * this.delay);
                    }
                    
                    // TODO add audio element and start recording
                });
            },
            stop: function(immediate) {
                this.nextQuantization(() => {
                    this.recording = false;
                    let track = this.tracks[this.tracks.length - 1];
                    track.end = Date.now();
                    track.length = track.end - track.start;

                    if (immediate) {
                        this.quantize = false;
                        this.record();
                        this.quantize = true;
                    }

                    // TODO stop recording audio
                });
            },
            tap: function() {
                this.tempo = tempoFinder.tap();
                this.base = Date.now(); 
                console.log(this.tempo);
            },
            muteTrack: function(index) {
                // TODO check quantization

                if (this.tracks.length > index)
                    this.tracks[index].muted = !this.tracks[index].muted;
            },
        }
    });

    Mousetrap.bind("space", () => vm.recording ? vm.stop() : vm.record());
    Mousetrap.bind("shift+space", () => vm.recording ? vm.stop(true) : vm.record());
    Mousetrap.bind("p", () => vm.playing ? vm.pause() : vm.play());
    Mousetrap.bind("t", vm.tap);
    Mousetrap.bind("d", () => vm.delay = (vm.delay + 1) % 5);
    Mousetrap.bind("q", () => vm.quantize = !vm.quantize);
    Mousetrap.bind("m", () => vm.playMetronome = !vm.playMetronome);
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

    $("main").style.opacity = 1.0;
}

function createComponent(name, obj) {
    let content = $("template#tmp-" + name).content;

    obj.data = () => obj.data;
    obj.template = content;

    return Vue.component(name, obj);
}
