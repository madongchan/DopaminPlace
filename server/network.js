// 노트북의 LAN IP를 찾고, 접속 주소와 QR을 만든다.
// 와이파이를 바꾸면 IP가 달라지므로 서버가 시작할 때마다 새로 찾는다.
import os from 'node:os';
import QRCode from 'qrcode';

// 터널 주소(npm run tunnel). 진행자가 /admin에서 넣을 수도 있다. — 8단계
// Railway에 올리면 공개 도메인이 환경변수로 들어온다. 그때는 LAN IP 대신 그 주소를 쓴다.
let 터널주소 = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null;

export function 터널주소설정(url) {
  터널주소 = url && url.trim() ? url.trim() : null;
  return 터널주소;
}

export function LAN주소찾기() {
  const 후보 = [];
  for (const [이름, 목록] of Object.entries(os.networkInterfaces())) {
    for (const i of 목록 || []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      // 가상 어댑터(VMware, VirtualBox, WSL, Hyper-V)는 휴대폰이 접속할 수 없다.
      if (/vmware|virtualbox|vethernet|wsl|loopback|hyper-v/i.test(이름)) continue;
      후보.push({ 이름, 주소: i.address });
    }
  }
  // 192.168.x.x 사설망을 가장 먼저 쓴다(집·행사장 공유기 대부분).
  후보.sort((a, b) => 점수(b.주소) - 점수(a.주소));
  return 후보;
}

function 점수(ip) {
  if (ip.startsWith('192.168.')) return 3;
  if (ip.startsWith('10.')) return 2;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  return 0;
}

export function 접속주소(port) {
  if (터널주소) return 터널주소;
  const 목록 = LAN주소찾기();
  if (목록.length === 0) return `http://localhost:${port}`;
  return `http://${목록[0].주소}:${port}`;
}

// ── IP 변화 감시 ────────────────────────────────────────────
// 행사장에서 와이파이를 바꾸거나 자리를 옮기면 노트북 IP가 달라진다.
// 서버는 0.0.0.0에 붙어 있어 새 IP로도 계속 받지만, TV에 뜬 주소·QR이 옛것이면
// 참가자가 접속하지 못한다. 그래서 3초마다 확인해서 바뀌면 알려준다.
let 감시타이머 = null;
let 마지막주소 = null;

export function IP감시시작(port, 바뀌면) {
  마지막주소 = 접속주소(port);
  if (감시타이머) clearInterval(감시타이머);
  감시타이머 = setInterval(() => {
    const 지금 = 접속주소(port);
    if (지금 === 마지막주소) return;
    const 이전 = 마지막주소;
    마지막주소 = 지금;
    바뀌면(지금, 이전);
  }, 3000);
  감시타이머.unref?.();   // 이 타이머 때문에 Ctrl+C가 안 먹는 일이 없도록
}

export function 감시주소맞추기(port) {
  // 터널 주소를 켜고 끌 때처럼, 밖에서 주소를 바꿨으면 기준값도 같이 맞춘다.
  마지막주소 = 접속주소(port);
}

export async function QR만들기(url) {
  // 외부 CDN을 쓰지 않는다. 서버가 QR 이미지를 data URL로 만들어 보낸다.
  return QRCode.toDataURL(url, {
    width: 520,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#00103D', light: '#FFFFFF' }
  });
}
