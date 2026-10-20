(function(N){
  'use strict';
  const MAX_PHOTO=400000,MAX_FILE=8*1024*1024;
  let photoTask=0;
  N.safePhotoURL=function(value){
    if(typeof value!=='string'||value.length>MAX_PHOTO)return '';
    if(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value;
    return this.safeURL(value);
  };
  N.avatarContent=function(user=this.user){
    const initials=(user?.name||'NX').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
    const photo=this.safePhotoURL(user?.photoURL);
    return '<span aria-hidden="true">'+this.escape(initials)+'</span>'+(photo?'<img src="'+this.escape(photo)+'" alt="" decoding="async" referrerpolicy="no-referrer">':'');
  };
  N.profileState=function(){
    return this.profileDraft||(this.profileDraft={name:this.user?.name||'',company:this.user?.company||'',photoURL:this.user?.photoURL||''});
  };
  N.resetProfileDraft=function(){photoTask++;this.profileDraft=null;this.profilePhotoBusy=false;this.profileSaving=false;};
  N.compressProfilePhoto=async function(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
    if(!file.size||file.size>MAX_FILE)throw new Error('A foto deve ter até 8 MB.');
    const url=URL.createObjectURL(file),image=new Image();
    try{
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Não foi possível abrir esta imagem. Escolha outro arquivo.'));image.src=url;});
      const w=image.naturalWidth,h=image.naturalHeight;
      if(!w||!h||w*h>24000000)throw new Error('Escolha uma imagem com até 24 megapixels.');
      const side=Math.min(w,h),size=Math.min(384,side),canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const context=canvas.getContext('2d');if(!context)throw new Error('Seu navegador não conseguiu preparar a foto.');
      context.fillStyle='#ffffff';context.fillRect(0,0,size,size);context.drawImage(image,(w-side)/2,(h-side)/2,side,side,0,0,size,size);
      const result=canvas.toDataURL('image/jpeg',.84);
      if(!result.startsWith('data:image/jpeg;base64,')||result.length>MAX_PHOTO)throw new Error('Não foi possível reduzir esta imagem. Escolha outra foto.');
      return result;
    }finally{image.onload=null;image.onerror=null;URL.revokeObjectURL(url);}
  };
  N.updatePhotoPreview=function(){
    const form=document.querySelector('#profile-form');if(!form)return;
    const state=this.profileState(),preview=form.querySelector('#profile-avatar');if(preview)preview.innerHTML=this.avatarContent(state);
    const remove=form.querySelector('[data-action="profile-photo-remove"]');if(remove)remove.disabled=!state.photoURL||!!this.profileSaving;
    const save=form.querySelector('[type="submit"]');if(save)save.disabled=!!(this.profilePhotoBusy||this.profileSaving);
    const status=form.querySelector('#profile-photo-status');if(status)status.textContent=this.profilePhotoBusy?'Preparando foto…':this.profileSaving?'Salvando perfil…':'A foto será atualizada ao salvar o perfil.';
  };
  N.chooseProfilePhoto=async function(file){
    const task=++photoTask,uid=this.uid;this.profilePhotoBusy=true;this.updatePhotoPreview();
    const error=document.querySelector('#profile-error');if(error)error.textContent='';
    try{
      const photoURL=await this.compressProfilePhoto(file);
      if(task===photoTask&&this.route==='perfil'&&this.uid===uid)this.profileState().photoURL=photoURL;
    }catch(failure){if(task===photoTask){const target=document.querySelector('#profile-error');if(target)target.textContent=this.errorText(failure);}}
    finally{if(task===photoTask){this.profilePhotoBusy=false;this.updatePhotoPreview();}}
  };
  N.removeProfilePhoto=function(){photoTask++;this.profilePhotoBusy=false;this.profileState().photoURL='';const input=document.querySelector('#profile-photo');if(input)input.value='';this.updatePhotoPreview();};
  N.saveProfile=async function(value){
    if(!this.user||!this.uid)throw new Error('Entre em uma conta para salvar seu perfil.');
    const uid=this.uid;
    if(this.profilePhotoBusy)throw new Error('Aguarde a preparação da foto.');
    const record={name:String(value.name||'').trim(),company:String(value.company||'').trim(),photoURL:value.photoURL||''};
    if(record.name.length<2||record.name.length>120)throw new Error('Informe um nome entre 2 e 120 caracteres.');
    if(record.company.length>140)throw new Error('A empresa deve ter até 140 caracteres.');
    if(record.photoURL&&!this.safePhotoURL(record.photoURL))throw new Error('Foto inválida. Escolha a imagem novamente.');
    if(this.mode==='demo'){
      const previous=this.data.users?.demo;this.data.users=this.data.users||{};this.data.users.demo={...previous,...record};
      try{this.persist();}catch(error){this.data.users.demo=previous;throw new Error('O navegador não conseguiu salvar o perfil. Libere espaço no armazenamento e tente novamente.');}
    }else{
      if(!this.online)throw new Error('Sem conexão. Reconecte para salvar seu perfil.');
      await this.db.ref('users/'+uid).update(record);
    }
    if(this.uid===uid&&this.user)this.user={...this.user,...record};return record;
  };
})(window.Nexus);
