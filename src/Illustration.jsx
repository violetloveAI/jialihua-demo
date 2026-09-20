import {assetUrl} from './assets.mjs';
import React from 'react';

const art = {
 welcome: ['welcome-family', 1774, 887],
 self: ['role-self-v2', 1536, 1024],
 helper: ['role-helper-v2', 1536, 1024],
 first: ['experience-first', 1536, 1024],
 used: ['experience-return', 1536, 1024],
 elderHome: ['home-self', 1774, 887],
 helperHome: ['home-helper-v3', 1774, 887],
 screenshot: ['feature-screenshot', 1254, 1254],
 reading: ['feature-reading', 1254, 1254],
 history: ['feature-history', 1254, 1254],
 video: ['feature-video', 1254, 1254],
 empty: ['history-empty', 1254, 1254],
};

// All illustrations accompany visible text; they never become the control's name.
export default function Illustration({kind,className='',eager=false}) {
 const [file,width,height]=art[kind];
 return <img className={'illustration '+className} src={assetUrl('/illustrations/selected/'+file+'.png')} width={width} height={height} alt="" aria-hidden="true" draggable="false" decoding="async" loading={eager?'eager':'lazy'}/>;
}
