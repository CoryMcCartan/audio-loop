/**
 * PARSING GRAMMAR
 */

program
	= info:pacing instructions:instructions* "\n"* { 
      return {
        timeSignature: info.timeSignature, 
        tempo: info.tempo, 
        instructions,
      }; 
    }
   
pacing 
	= timeSignature:timeSignature sp "at"i sp tempo:tempo {
    	return {
        	timeSignature,
            tempo,
        };
    }

timeSignature "a time signature ('4/4')"
	= num:number "/" denom:number { return [num, denom]; }

tempo "a tempo ('60 bpm')"
	= tempo:number msp "bpm"i { return tempo; }

instructions "an instruction"
    = "\n"+ instr:(record / mute / wait / metronome / end) msp? { return instr; }

record
	= "record"i sp n:number sp bars {
    	return {
        	type: "record",
            n,
        };
    }

mute
	= "mute"i sp "track"i sp track:number {
    	return {
        	type: "mute",
            track,
        };
    }

wait
	= "wait"i sp n:number sp bars {
    	return {
        	type: "wait",
            n,
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
