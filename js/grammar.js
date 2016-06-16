/**
 * PARSING GRAMMAR
 */

program
	= title? info:pacing instructions:instructions* "\n"* { 
      return {
        timeSignature: info.timeSignature, 
        tempo: info.tempo, 
        instructions: instructions,
      }; 
    }

title
    = [A-Za-z0-9 \'\"\/\\.,“‘”’]* "\n"+
   
pacing 
	= timeSignature:timeSignature (sp "at"i / ",") sp tempo:tempo {
    	return {
            timeSignature: timeSignature,
            tempo: tempo,
        };
    }

timeSignature "a time signature ('4/4')"
	= ("in"i sp)? num:number "/" denom:number { return [num, denom]; }
	/ ("in"i sp)? "cut"i sp "time"i { return [2, 2]; }
	/ ("a"i sp)? "waltz"i { return [3, 4]; }
	/ ("a"i sp)? "jig"i { return [6, 8]; }
	/ ("a"i sp)? "reel"i { return [4, 4]; }

tempo "a tempo ('60 bpm')"
	= tempo:number msp "bpm"i { return tempo; }
	/ "largo"i { return 40; }
	/ "adagio"i { return 56; }
	/ "andante"i { return 76; }
	/ "moderato"i { return 100; }
	/ "allegretto"i { return 120; }
	/ "allegro"i { return 144; }
	/ "vivace"i { return 176; }
	/ "presto"i { return 200; }

instructions "an instruction"
    = "\n"+ instr:(record / mute / wait / metronome / end) msp? { return instr; }

record
	= "record"i sp n:number sp bars {
    	return {
        	type: "record",
            n: n,
        };
    }

mute
	= ("mute"i / "unmute"i) sp "track"i sp track:number {
    	return {
        	type: "mute",
            track: track,
        };
    }

wait
	= "wait"i sp n:number sp bars {
    	return {
        	type: "wait",
            n: n,
        };
    }

metronome
    = "metronome"i sp choice:("on" / "off") { 
        return {
            type: "metronome",
            status: choice === "on",
        };
    }

end
	= "end"i { return {type: "end"}; }
    
bars "'bars' or 'measures'"
	= ("bars"i / "measures"i) / ("bar"i / "measure"i)

number "a number"
	= digits:[0-9]+ { return parseInt(digits.join("")); }

sp "a space"
	= [" "\t]+
msp
	= [" "\t]*
