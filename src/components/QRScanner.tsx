import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

declare global { interface Window { BarcodeDetector?: new (opts:{formats:string[]})=>{detect:(source:CanvasImageSource)=>Promise<Array<{rawValue:string}>>}; } }
const cleanCode=(text:string)=>text.replace(/^BWJOIN:/,'').replace(/^BWREC:/,'').split(':')[0].trim();
export function QRScanner({onCode,onClose}:{onCode:(code:string)=>void;onClose:()=>void}){
  const videoRef=useRef<HTMLVideoElement|null>(null);const [error,setError]=useState('');const [mode,setMode]=useState<'native'|'fallback'>('native');
  useEffect(()=>{let stopped=false;let stream:MediaStream|undefined;let timer=0;let fallback:Html5Qrcode|undefined;
    const finish=(text:string)=>{const code=cleanCode(text);if(/^\d{4}$/.test(code)&&!stopped){stopped=true;onCode(code)}};
    const startFallback=async()=>{setMode('fallback');try{fallback=new Html5Qrcode('qr-reader-fallback');const cams=await Html5Qrcode.getCameras();if(!cams.length)throw new Error('카메라를 찾을 수 없습니다.');const rear=cams.find(c=>/back|rear|environment|후면/i.test(c.label))??cams[cams.length-1];await fallback.start(rear.id,{fps:8,qrbox:{width:230,height:230}},finish,()=>{});}catch(e){setError(e instanceof Error?e.message:'QR 카메라를 시작하지 못했습니다.')}};
    const start=async()=>{try{
      if(!window.BarcodeDetector){await startFallback();return;}
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
      const video=videoRef.current;if(!video)return;video.srcObject=stream;await video.play();const detector=new window.BarcodeDetector({formats:['qr_code']});
      const scan=async()=>{if(stopped)return;try{const hits=await detector.detect(video);if(hits[0]?.rawValue){finish(hits[0].rawValue);return;}}catch{}timer=window.setTimeout(scan,180)};scan();
    }catch(e){setError(e instanceof Error?e.message:'카메라 권한을 확인해주세요.');await startFallback();}};
    void start();return()=>{stopped=true;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());if(fallback){void fallback.stop().catch(()=>{});try{fallback.clear()}catch{}}};
  },[onCode]);
  return <div className="modal-back"><div className="modal qr-scan-modal"><h2>QR 코드 스캔</h2><p>카메라를 QR 코드에 맞춰주세요.</p><div className="qr-camera-frame">{mode==='native'?<video ref={videoRef} playsInline muted/>:<div id="qr-reader-fallback"/>}<i/><i/><i/><i/></div>{error&&<div className="form-error">{error}</div>}<small className="qr-help">카메라가 보이지 않으면 브라우저의 카메라 권한을 허용한 뒤 다시 시도하세요.</small><button className="secondary" onClick={onClose}>닫기</button></div></div>;
}
