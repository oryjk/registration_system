import { expect,test } from "bun:test";
import { resolveHonorSource, ownHonorAvatarTeam, honorTitle, formatHonorPoints, honorSharePath } from "../honorState";
test("honor source accepts scene/code and rejects invalid route inputs",()=>{
 const code="abcdefghijklmnopqrstuv";
 expect(resolveHonorSource({scene:encodeURIComponent(code)})).toEqual({code});
 expect(resolveHonorSource({code,teamId:"999"})).toEqual({code});
 expect(resolveHonorSource({teamId:"11"})).toEqual({teamId:11});
 for(const input of [{code:"bad",teamId:"11"},{teamId:"-1"},{teamId:"1.5"},{scene:"%invalid"},{teamId:"Infinity"}])expect(resolveHonorSource(input)).toEqual(null);
 expect(honorSharePath(code)).toEqual("/pages/honors/index?code="+code);
});
test("avatar sharing requires own user and actual registration team",()=>{
 expect(ownHonorAvatarTeam({id:4,name:"Carl",teamId:11},4)).toEqual(11);
 expect(ownHonorAvatarTeam({id:5,name:"other",teamId:11},4)).toEqual(null);
 expect(ownHonorAvatarTeam({id:4,name:"Carl"},4)).toEqual(null);
 expect(ownHonorAvatarTeam({id:4,name:"Carl",teamId:11})).toEqual(null);
});
test("honors preserve public point scale and zero gets no medal",()=>{
 expect(formatHonorPoints(259)).toEqual("259");expect(formatHonorPoints(260.2)).toEqual("260.2");
 expect(formatHonorPoints(NaN)).toEqual("0");
 expect(honorTitle(0,1)).toEqual("");expect(honorTitle(259,4)).toEqual("");expect(honorTitle(10,1)).toEqual("年度活跃冠军");
});
