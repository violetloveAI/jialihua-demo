import React from 'react';
import {Wifi,BatteryFull,Signal} from 'lucide-react';
export default function DeviceFrame({children}){
 return <div className="device-stage"><div className="device-frame"><div className="device-status" aria-hidden="true"><span>9:41</span><i/><span><Signal/><Wifi/><BatteryFull/></span></div><div className="device-viewport">{children}</div><div className="device-home-indicator" aria-hidden="true"/></div></div>;
}
