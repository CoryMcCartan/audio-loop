// METRONOME

"use strict";

window.Metronome = (function() {
    
})();

window.tempoFinder = (function() {
    const timeout = 2000;
    let times = [];
    let lastTime = false;

    return {
        tap: function() {
            let bpm;

            if (lastTime) {
                let difference = Date.now() - lastTime;
                if (difference > timeout) {
                    times = [];
                    lastTime = Date.now();
                    return;
                } else {
                    times.push(difference);
                }

                let average = times.reduce((p, c) => p + c) / times.length;
                bpm = 60 / (average / 1000);
            }
            
            lastTime = Date.now();
            return bpm;
        },
    }
})();
