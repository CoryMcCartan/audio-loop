/**
 * Tock by Mr Chimp - github.com/mrchimp/tock
 * Based on code by James Edwards:
 *    sitepoint.com/creating-accurate-timers-in-javascript/
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Tock = factory();
    }
}(this, function () {

    /**
     * Called every tick for countdown clocks.
     * i.e. once every this.interval ms
     */
    function _tick () {
        this.time += this.interval;

        if (this.countdown && (this.duration_ms - this.time < 0)) {
            this.final_time = 0;
            this.go = false;
            this.callback(this);
            clearTimeout(this.timeout);
            this.complete(this);
            return;
        } else {
            this.callback(this);
        }

        var diff = (performance.now() - this.start_time) - this.time,
            next_interval_in = diff > 0 ? this.interval - diff : this.interval;

            if (next_interval_in <= 0) {
                this.missed_ticks = Math.floor(Math.abs(next_interval_in) / this.interval);
                this.time += this.missed_ticks * this.interval;

                if (this.go) {
                    _tick.call(this);
                }
            } else if (this.go) {
                this.timeout = setTimeout(_tick.bind(this), next_interval_in);
            }
    }

    /**
     * Called by Tock internally - use start() instead
     */
    function _startCountdown (duration) {
        this.duration_ms = duration;
        this.start_time = performance.now();
        this.time = 0;
        this.go = true;
        _tick.call(this);
    }

    /**
     * Called by Tock internally - use start() instead
     */
    function _startTimer (start_offset) {
        this.start_time = start_offset || performance.now();
        this.time = 0;
        this.go = true;
        _tick.call(this);
    }


    var Tock = function (options) {
        options = options || {};

        if (! (this instanceof Tock)) return new Tock(options);

        Tock.instances = (Tock.instances || 0) + 1;

        this.go           = false;
        this.timeout      = null;
        this.missed_ticks = null;
        this.interval     = options.interval || 10;
        this.countdown    = options.countdown || false;
        this.start_time   = 0;
        this.pause_time   = 0;
        this.final_time   = 0;
        this.duration_ms  = 0;
        this.time         = 0;
        this.callback     = options.callback || function () {};
        this.complete     = options.complete || function () {};
    };

    /**
     * Reset the clock
     */
    Tock.prototype.reset = function () {
        if (this.countdown) {
            return false;
        }

        this.stop();
        this.start_time = 0;
        this.time = 0;
    };

    /**
     * Start the clock.
     * @param {Various} time Accepts a single "time" argument
     *   which can be in various forms:
     *   - MM:SS
     *   - MM:SS:ms or MM:SS.ms
     *   - HH:MM:SS
     *   - yyyy-mm-dd HH:MM:SS.ms
     *   - milliseconds
     */
    Tock.prototype.start = function (time) {
        if (this.go) return false;

        time = time || 0;

        this.start_time = time;
        this.pause_time = 0;

        if (this.countdown) {
            _startCountdown.call(this, time);
        } else {
            _startTimer.call(this, performance.now() - time);
        }
    };

    /**
    * Stop the clock and clear the timeout
    */
    Tock.prototype.stop = function () {
        this.pause_time = this.lap();
        this.go = false;

        clearTimeout(this.timeout);

        if (this.countdown) {
            this.final_time = this.duration_ms - this.time;
        } else {
            this.final_time = (performance.now() - this.start_time);
        }
    };

    /**
     * Stop/start the clock.
     */
    Tock.prototype.pause = function () {
        if (this.go) {
            this.pause_time = this.lap();
            this.stop();
        } else {
            if (this.pause_time) {
                if (this.countdown) {
                    _startCountdown.call(this, this.pause_time);
                } else {
                    _startTimer.call(this, performance.now() - this.pause_time);
                }

                this.pause_time = 0;
            }
        }
    };

    /**
     * Get the current clock time in ms.
     * Use with Tock.msToTime() to make it look nice.
     * @return {Integer} Number of milliseconds ellapsed/remaining
     */
    Tock.prototype.lap = function () {
        if (this.go) {
            var now;

            if (this.countdown) {
                now = this.duration_ms - (performance.now() - this.start_time);
            } else {
                now = (performance.now() - this.start_time);
            }

            return now;
        }

        return this.pause_time || this.final_time;
    };

    return Tock;
}));
