'use client';
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}){
 return <main className="ep-route-error"><section><h1>Something went wrong</h1><p role="alert">EventPass could not load this page. Try again. If the problem continues, contact support.</p><button type="button" className="primary" onClick={reset}>Try again</button></section></main>;
}
