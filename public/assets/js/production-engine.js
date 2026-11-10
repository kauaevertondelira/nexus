/* Detector de passagem: processamento local, sem envio de imagens. */
(function(N) {
  'use strict';
  const defaults=Object.freeze({sensitivity:'high',cooldownMs:80,minCooldownMs:0,maxCooldownMs:10000});
  class PassageDetector {
    constructor({sensitivity=defaults.sensitivity,cooldownMs=defaults.cooldownMs,calibrationFrames=12,calibrationMs=1000}={}) {
      const presets={high:[14,.025],normal:[24,.08],low:[38,.16]};
      [this.pixelThreshold,this.enterThreshold]=presets[sensitivity]||presets.normal;
      this.exitThreshold=this.enterThreshold*.4;
      const interval=Number(cooldownMs);
      this.cooldownMs=Number.isFinite(interval)?Math.max(defaults.minCooldownMs,Math.min(defaults.maxCooldownMs,interval)):defaults.cooldownMs;
      this.calibrationFrames=Math.max(1,Math.round(Number(calibrationFrames)||12));
      this.calibrationMs=Math.max(0,Number(calibrationMs)||0);
      this.reset();
    }
    reset() {
      this.background=null;this.samples=0;this.reference=0;this.occupied=false;
      this.enterAt=null;this.clearAt=null;this.lastCount=-Infinity;this.lastFrame=null;
      this.enterFrames=0;this.clearFrames=0;this.calibrationStarted=null;
      this.lastResult={count:false,state:'calibrating',progress:0,score:0};
    }
    process(rgba,time,reference=0) {
      if(!rgba?.length||rgba.length%4||!Number.isFinite(time))throw new Error('Quadro de câmera inválido.');
      if(this.background&&this.background.length!==rgba.length)this.reset();
      if(this.lastFrame!==null&&time<=this.lastFrame)return {...this.lastResult,count:false};
      const elapsed=this.lastFrame===null?0:time-this.lastFrame;
      if(elapsed>1000) {
        // Uma suspensão não pode ser interpretada como uma passagem completa.
        this.enterAt=null;this.clearAt=null;this.enterFrames=0;this.clearFrames=0;
      }
      this.lastFrame=time;
      if(this.calibrationStarted===null)this.calibrationStarted=time;
      const calibrationElapsed=time-this.calibrationStarted;
      if(this.samples<this.calibrationFrames||calibrationElapsed<this.calibrationMs) {
        if(!this.background)this.background=new Float32Array(rgba.length);
        this.samples++;
        for(let i=0;i<rgba.length;i++)this.background[i]+=(rgba[i]-this.background[i])/this.samples;
        this.reference+=(reference-this.reference)/this.samples;
        return this.lastResult={count:false,state:'calibrating',progress:Math.min(1,this.samples/this.calibrationFrames,this.calibrationMs?calibrationElapsed/this.calibrationMs:1),score:0};
      }
      // Uma faixa fora da área de passagem compensa variações suaves de exposição.
      const exposure=reference-this.reference;
      if(Math.abs(exposure)>55){this.enterAt=null;this.clearAt=null;this.enterFrames=0;this.clearFrames=0;return this.lastResult={count:false,state:'lighting',score:0};}
      let changed=0;
      for(let i=0;i<rgba.length;i+=4) {
        const difference=(Math.abs(rgba[i]-this.background[i]-exposure)+Math.abs(rgba[i+1]-this.background[i+1]-exposure)+Math.abs(rgba[i+2]-this.background[i+2]-exposure))/3;
        if(difference>=this.pixelThreshold)changed++;
      }
      const score=changed/(rgba.length/4);
      let count=false;
      if(!this.occupied) {
        if(score>=this.enterThreshold) {
          if(this.enterAt===null)this.enterAt=time;
          this.enterFrames++;
          // Dois quadros reais confirmam a passagem sem a antiga espera de 80 ms.
          if(this.enterFrames>=2&&time-this.enterAt>=20) {
            // Mesmo durante o intervalo mínimo, bloquear até a próxima área livre.
            this.occupied=true;this.clearAt=null;this.clearFrames=0;
            if(time-this.lastCount>=this.cooldownMs){count=true;this.lastCount=time;}
          }
        }else {this.enterAt=null;this.enterFrames=0;}
      }else if(score<=this.exitThreshold) {
        if(this.clearAt===null)this.clearAt=time;
        this.clearFrames++;
        if(this.clearFrames>=2&&time-this.clearAt>=20){this.occupied=false;this.enterAt=null;this.clearAt=null;this.enterFrames=0;this.clearFrames=0;}
      }else {this.clearAt=null;this.clearFrames=0;}
      // Atualizar o fundo somente quando a área está efetivamente livre.
      if(!this.occupied&&score<this.exitThreshold) {
        // A adaptação do fundo mantém a mesma velocidade em câmeras de 15/30/60 fps.
        const alpha=1-Math.pow(1-.008,Math.min(elapsed,100)/100);
        for(let i=0;i<rgba.length;i++)this.background[i]+=(rgba[i]-this.background[i])*alpha;
        this.reference+=(reference-this.reference)*alpha;
      }
      return this.lastResult={count,state:this.occupied?'occupied':'ready',score};
    }
  }
  PassageDetector.defaults=defaults;
  N.PassageDetector=PassageDetector;
})(window.Nexus);
