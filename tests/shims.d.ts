// Local typecheck shims, used only when @types/react is not installed (offline). Real builds use @types/react.
declare module 'react' { const x: any; export = x; }
declare module 'react-dom/client' { export const createRoot: any; }
declare module 'react-dom/server' { export const renderToStaticMarkup: any; }
declare module 'react/jsx-runtime' { export const jsx: any, jsxs: any, Fragment: any; }
declare module '*.css';
declare namespace JSX { interface IntrinsicElements { [k: string]: any } interface Element {} }
