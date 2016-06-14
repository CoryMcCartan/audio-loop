/*
 * LOOPING SOFTWARE
 *
 * CORY McCARTAN
 */

"use strict";

function main() {
    const key_TREBLE = "verdi-treble";
    const key_BASS = "verdi-bass";
    const key_QUANTIZE = "verdi-quantize";

    let trebleGain = +localStorage[key_TREBLE] || 0;
    let bassGain = +localStorage[key_BASS] || 0;
    let quantize = key_QUANTIZE in localStorage ? 
        localStorage[key_QUANTIZE] === "true" : true;

    window.vm = new Vue({
    el: "main",

    data: {
        app: {
            name: "Verdi",
            version: "1.0.0",
        },

        maxTime: 10.0,
        playing: false,
        base: null,
        delay: 0,
        currentTime: 0,

        tempo: null,
        playMetronome: false,
        tapColor: false,
        hasStartedMetronome: false,

        quantize,
        recording: false,
        hasPressedRecord: false,
        hasPressedStop: false,
        tracks: [],

        script: false,
        scriptText: "",

        trebleGain,
        bassGain,

        alertText: "",
        alertDialog: $("dialog#alert"),
        aboutDialog: $("dialog#about"),
        eqDialog: $("dialog#eq"),
    },

    watch: {
        trebleGain(v) {
            audio.setTreble(v);  
            localStorage[key_TREBLE] = v;
        },
        bassGain(v) {
            audio.setBass(v);  
            localStorage[key_BASS] = v;
        },
        quantize(v) {
            localStorage[key_QUANTIZE] = v;
        },
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
            if (length > this.maxTime) {
                this.maxTime = 1.4 * length;
                dispatchEvent(trackLengthChange);
            }
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
            if (this.recording) this.stop(true);

            if (this.playMetronome && this.tempo) {
                audio.metronome.stop();
                this.hasStartedMetronome = false;
            }

            audio.mute(true);

            this.script = false;
        },
        play() {
            this.playing = true; 
            let startTime = audio.time();

            if (this.script) 
                this.runScript();

            //if (!this.base) 
                this.base = startTime;
            if (this.playMetronome) this.base += 0.001; // 1ms delay on met

            audio.unmute(true);

            for (let track of this.tracks) {
                if (!track.audio) continue;
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

            if (!this.script && this.playMetronome && this.tempo) {
                audio.metronome.setTempo(this.tempo);
                audio.metronome.start();
                this.hasStartedMetronome = true;
            }
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
        stop(mute = false) {
            if (this.hasPressedStop) return;
            this.hasPressedStop = true;
            this.hasPressedRecord = false;

            this.nextQuantization(now => { 
                this.hasPressedStop = false;
                this.recording = false;
                
                let index = this.tracks.findIndex(t => !t.end);
                let track = this.tracks[index];

                track.end = now;
                track.length = track.end - track.start;

                audio.stop(now, source => {
                    Vue.set(track, "audio", source);
                    track.time = audio.time() - track.end;

                    if (mute)
                        track.audio.mute();

                    drawWaveform(source, index);
                });
            });
        },
        tap() {
            if (this.playing) return;
            this.tempo = tempoFinder.tap();

            this.tapColor = true;
            setTimeout(() => this.tapColor = false, 150);
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
            let n = this.tracks.length;
            if (n === 0) return;

            let zip = new JSZip();
            for (let i = 0; i < n; i++) {
                zip.file(`track-${i+1}.wav`, this.tracks[i].audio.export());
            }

            zip.generateAsync({type: "blob"}).then(blob => {
                download(blob, "tracks.zip", "application/zip");
            });
        },
        chooseFile() {
            let fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".loop";
            fileInput.onchange = this.loadScript;
            fileInput.click();
        },
        loadScript(evt) {
            let f = evt.target.files[0];
            if (!f) {
                this.showAlert("Error loading file.  Please try again.");
                return;
            }
            if (f.name.split(".").pop() !== "loop") { // must be a .loop file
                this.showAlert("Need .loop file.");
                return; 
            }

            let reader = new FileReader();
            reader.onload = e => {
                this.scriptText = e.target.result.replace(/\(.+\)/g, "");
                this.processScript();
            };
            reader.readAsText(f);
        },
        processScript(text = this.scriptText) {
            if (text.trim() === "") return;

            let parsed;
            try {
                parsed = scriptParser.parse(text);
            } catch (e) {
                this.showAlert(e);
                return;
            }

            let beatsPerMeasure = parsed.timeSignature[0];
            if (parsed.timeSignature[1] === 8)
                beatsPerMeasure /= 3;

            this.tempo = parsed.tempo;
            this.playMetronome = false;
            this.script = {
                commands: parsed.instructions,
                beatsPerMeasure,
            };
        },
        runScript() {
            let offset = 0;
            let measureLength = this.script.beatsPerMeasure * 60 / this.tempo;
            let quantize = this.quantize;
            this.quantize = true;

            for (let command of this.script.commands) {
                switch (command.type) {
                    case "metronome":
                        setTimeout(() => {
                            if (this.playMetronome !== command.status)
                                this.toggleMetronome();
                        }, 1000*offset);
                        break;
                    case "wait":
                        offset += measureLength * command.n;
                        break;
                    case "record":
                        let early = 60;
                        setTimeout(this.record, 1000*offset - early);
                        offset += measureLength * command.n;
                        setTimeout(this.stop, 1000*offset - 2*early);
                        break;
                    case "mute":
                        setTimeout(this.muteTrack.bind(this, command.track - 1), 1000*offset);
                        break;
                    case "end":
                        setTimeout(this.pause, 1000*offset + 50);
                        break;
                }
            }

            setTimeout(() => {
               this.script = null; 
            this.quantize = quantize;
            }, offset);
        },
        clearScript() {
            this.pause();
            this.tempo = false;
            this.playMetronome = false;
        },
        showAlert(text) {
            this.alertText = text;   
            $("dialog#alert").showModal();
        },
        resetEQ() {
            this.trebleGain = 0;
            $$(".mdl-slider")[0].MaterialSlider.change(0);
            audio.setTreble(0);

            this.bassGain = 0;
            $$(".mdl-slider")[1].MaterialSlider.change(0);
            audio.setBass(0);
        }
    },
    });

    // KEYBOARD SHORTCUTS
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

    // DRAG AND DROP
    let overlay = $("#overlay");
    let lastTarget;

    window.ondragover = e => e.preventDefault();

    window.ondragenter = e => {
        e.preventDefault();
        lastTarget = e.target;
        overlay.style.visibility = "visible";
        overlay.style.opacity = 0.35;
    };

    window.ondragleave = e => {
        e.preventDefault();
        if (e.target !== lastTarget) return;
        overlay.style.visibility = "hidden";
        overlay.style.opacity = 0.0;
    };

    window.ondrop = e => {
        e.preventDefault();

        overlay.style.visibility = "hidden";
        overlay.style.opacity = 0.0;

        vm.loadScript({
            target: e.dataTransfer,
        });
    };

    audio.metronome.initialize()
    .then(audio.initialize())
    .then(() => {
        let meter = $(".meter");
        let monitorMeter = function() {
            meter.style.height = (Math.sqrt(audio.getMeter()) * 100) + "vh"; 
            requestAnimationFrame(monitorMeter);
        };
        requestAnimationFrame(monitorMeter);

        $("main").style.opacity = 1.0;
        screen.keepAwake = true;
    });

    window.trackLengthChange = new Event("tracklengthchange");
}

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("service-worker.js", {
        scope: location.pathname.replace("index.html", "")
    }).then(() => {
        console.log("Service Worker Registered.");
    })
}

function drawWaveform(source, index) {
    let el = $$(".bar")[index];
    let bounds = el.getBoundingClientRect();

    let length = source.buffer.length;
    let raw = source.buffer.getChannelData(0);
    const step = 200;
    let data = new Float32Array(length / step);
    for (let i = 0; i < length; i += step) {
        data[i/step] = Math.abs(Math.max(raw[i], raw[i+50], raw[i+100], raw[i+150]));
    }
    // norm
    data[0] = 0;
    data[data.length - 1] = 0;

    let x = d3.scale.linear()
        .domain([0, length / step])
        .range([0, bounds.width]);
    let y = d3.scale.linear()
        .domain([-1, 1])
        .range([0, bounds.height]);

    let waveform_top = d3.svg.line()
        .x((d, i) => x(i))
        .y(y);

    let waveform_bottom = d3.svg.line()
        .x((d, i) => x(i))
        .y(d => y(-d));

    let graph = d3.select(el).append("svg")
        .attr("width", bounds.width)
        .attr("height", bounds.height);

    graph.append("path")
        .datum(data)
        .attr("class", "top")
        .attr("d", waveform_top)
        .attr("stroke", "black")
        .attr("opacity", 0.3)
        .attr("stroke-width", 1);

    graph.append("path")
        .datum(data)
        .attr("class", "bottom")
        .attr("d", waveform_bottom)
        .attr("stroke", "black")
        .attr("opacity", 0.3)
        .attr("stroke-width", 1);

    let adjust = function() {
        let bounds = el.getBoundingClientRect();

        x.range([0, bounds.width]);
        y.range([0, bounds.height]);

        graph.attr("width", bounds.width);
        graph.attr("height", bounds.height);

        graph.select("path.top")
            .attr("d", waveform_top);
        graph.select("path.bottom")
            .attr("d", waveform_bottom);
    };

    window.addEventListener("resize", adjust);
    window.addEventListener("tracklengthchange", () => {
        setTimeout(adjust, 60);
    });
}
