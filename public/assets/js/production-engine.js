/* Detector de passagem: processamento local, sem envio de imagens. */
(function(N) {
  'use strict';
  class PassageDetector {
    constructor({sensitivity='normal',cooldownMs=800,calibrationFrames=12}={}) {
      const presets={high:[20,.10],normal:[30,.18],low:[44,.28]};
      [this.pixelThreshold,this.enterThreshold]=presets[sensitivity]||presets.normal;
      this.exitThreshold=this.enterThreshold*.35;
      this.cooldownMs=Math.max(300,Math.min(10000,Number(cooldownMs)||800));
      this.calibrationFrames=calibrationFrames;
      this.reset();
    }
    reset() {
      this.background=null;this.samples=0;this.reference=0;this.occupied=false;
      this.enterAt=null;this.clearAt=null;this.lastCount=-Infinity;this.lastFrame=null;
    }
    process(rgba,time,reference=0) {
      if(!rgba?.length||rgba.length%4||!Number.isFinite(time))throw new Error('Quadro de câmera inválido.');
      if(this.background&&this.background.length!==rgba.length)this.reset();
      if(this.lastFrame!==null&&(time<=this.lastFrame||time-this.lastFrame>1000)) {
        // Uma suspensão não pode ser interpretada como uma passagem completa.
        this.enterAt=null;this.clearAt=null;
      }
      this.lastFrame=time;
      if(this.samples<this.calibrationFrames) {
        if(!this.background)this.background=new Float32Array(rgba.length);
        this.samples++;
        for(let i=0;i<rgba.length;i++)this.background[i]+=(rgba[i]-this.background[i])/this.samples;
        this.reference+=(reference-this.reference)/this.samples;
        return {count:false,state:'calibrating',progress:this.samples/this.calibrationFrames,score:0};
      }
      // Uma faixa fora da área de passagem compensa variações suaves de exposição.
      const exposure=reference-this.reference;
      if(Math.abs(exposure)>55){this.enterAt=null;this.clearAt=null;return {count:false,state:'lighting',score:0};}
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
          if(time-this.enterAt>=80) {
            // Mesmo durante o intervalo mínimo, bloquear até a próxima área livre.
            this.occupied=true;this.clearAt=null;
            if(time-this.lastCount>=this.cooldownMs){count=true;this.lastCount=time;}
          }
        }else this.enterAt=null;
      }else if(score<=this.exitThreshold) {
        if(this.clearAt===null)this.clearAt=time;
        if(time-this.clearAt>=220){this.occupied=false;this.enterAt=null;this.clearAt=null;}
      }else this.clearAt=null;
      // Atualizar o fundo somente quando a área está efetivamente livre.
      if(!this.occupied&&score<this.exitThreshold) {
        for(let i=0;i<rgba.length;i++)this.background[i]+=(rgba[i]-this.background[i])*.008;
        this.reference+=(reference-this.reference)*.008;
      }
      return {count,state:this.occupied?'occupied':'ready',score};
    }
  }
  N.PassageDetector=PassageDetector;
})(window.Nexus);
