export class LabAudio {
  constructor({ambient=true}={}){this.enabled=true;this.context=null;this.ambient=ambient;}
  async start(){
    if(this.context){if(this.context.state==='suspended')await this.context.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try {
      this.context=new AC();const c=this.context;
      this.master=c.createGain();this.master.gain.value=this.enabled?.46:0;this.master.connect(c.destination);
      this.buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.buffer.getChannelData(0);
      let previous=0;for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.04-.02)/1.02;data[i]=previous*3.5;}
      if(this.ambient){const room=c.createBufferSource();room.buffer=this.buffer;room.loop=true;
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=230;
      const gain=c.createGain();gain.gain.value=.085;room.connect(filter);filter.connect(gain);gain.connect(this.master);room.start();
      for(const [frequency,volume]of[[67,.012],[101,.005]]){const osc=c.createOscillator();osc.frequency.value=frequency;const g=c.createGain();g.gain.value=volume;osc.connect(g);g.connect(this.master);osc.start();}}
    }catch{this.context=null;}
  }
  mute(muted){this.enabled=!muted;if(this.master)this.master.gain.setTargetAtTime(muted?0:.46,this.context.currentTime,.08);}
  event(event){
    if(!this.context||!this.enabled)return;const c=this.context,t=c.currentTime;
    const noise=c.createBufferSource();noise.buffer=this.buffer;
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=event.type==='impact'?100:event.type==='pushOff'?185:event.type==='catch'?350:520;f.Q.value=.6;
    const g=c.createGain();const length=event.type==='grip'?.15:event.type==='pushOff'?.18:.13;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(event.type==='impact'?.35:event.type==='pushOff'?.28:.20,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+length);
    const p=c.createStereoPanner();p.pan.value=(event.side||0)*.60;
    noise.connect(f);f.connect(g);g.connect(p);p.connect(this.master);noise.start(t);noise.stop(t+length+.04);
    noise.onended=()=>{noise.disconnect();f.disconnect();g.disconnect();p.disconnect();};
  }
}
