/**
 * A: BE가 발급한 서명 업로드 URL(UploadTicket.upload_url)에 파일을 직접 PUT한다.
 * 키 없이 파일 본문과 Content-Type만 보낸다(BE app/storage.py). 진행률이 필요해 fetch 대신 XHR을 쓴다.
 * 서명 URL은 한 번만 쓸 수 있다 — 실패하면 새 업로드 URL을 받아 다시 올린다. URL은 로그에 남기지 않는다.
 */
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export function uploadFile(url: string, file: Blob, contentType: string, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new UploadError("영상을 올리지 못했어요. 다시 시도해 주세요."));
      }
    };
    xhr.onerror = () => reject(new UploadError("인터넷 연결이 끊겨 영상을 올리지 못했어요. 다시 시도해 주세요."));
    xhr.send(file);
  });
}
