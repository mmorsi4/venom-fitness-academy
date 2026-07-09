export function processImageFile(file: File, targetSize: number = 200): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error("Failed to get canvas context"));
      }

      // Crop to square from the center
      const size = Math.floor(Math.min(img.width, img.height));
      const startX = Math.floor((img.width - size) / 2);
      const startY = Math.floor((img.height - size) / 2);

      // Fill white background for JPEG safety
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetSize, targetSize);

      ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) {
            resolve({ blob, url: dataUrl });
          } else {
            reject(new Error("Failed to create blob"));
          }
        },
        "image/jpeg",
        0.85
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    
    img.src = objectUrl;
  });
}
