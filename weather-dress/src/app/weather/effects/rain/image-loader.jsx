const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Yd0xm4AAAAASUVORK5CYII=";

function loadImage(src,i,onLoad){
    return new Promise((resolve,reject)=>{
      if(typeof src=="string"){
        src={
          name:"image"+i,
          src,
        };
      }
  
      let img=new Image();
      src.img=img;
      
      img.addEventListener("load",(event)=>{
        if(typeof onLoad=="function"){
          onLoad.call(null,img,i);
        }
        
        resolve(src);
      });

      img.addEventListener("error",()=>{
        // keep the promise chain moving even if the asset can't be fetched
        img.src = TRANSPARENT_PIXEL;
        resolve(src);
      });
      
      const resolvedSrc =
        typeof src.src === "string"
          ? src.src
          : (src.src && src.src.src) || "";
      img.src = resolvedSrc || TRANSPARENT_PIXEL;
    })
  }
  
  function loadImages(images,onLoad){
    return Promise.all(images.map((src,i)=>{
      return loadImage(src,i,onLoad);
    }));
  }
  
  export default function ImageLoader(images,onLoad){
    return new Promise((resolve,reject)=>{
      loadImages(images,onLoad).then((loadedImages)=>{
        let r={};
        loadedImages.forEach((curImage)=>{
          r[curImage.name]={
            img:curImage.img,
            src:curImage.src,
          };
        });
        resolve(r);
      });
    })
  }
