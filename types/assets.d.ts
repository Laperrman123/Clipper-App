// Deklarasi modul aset gambar supaya bisa di-import langsung dengan ES import.
// Metro mengubah import ini menjadi asset ID (number) saat bundling.
declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.jpeg' {
  const value: number;
  export default value;
}

declare module '*.webp' {
  const value: number;
  export default value;
}
