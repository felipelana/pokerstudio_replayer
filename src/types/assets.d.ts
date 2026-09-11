/**
 * The Vite app gets these from `vite/client`. The Next app declares them here,
 * so the same import works under both shells without the source being touched.
 */
declare module '*?url' {
  const src: string;
  export default src;
}
