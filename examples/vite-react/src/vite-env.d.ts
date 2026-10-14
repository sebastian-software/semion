/// <reference types="vite/client" />

declare module "*.svg?no-inline" {
  const assetUrl: string;
  export default assetUrl;
}
