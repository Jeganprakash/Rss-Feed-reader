"use strict";(()=>{var e={};e.id=307,e.ids=[307],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7790:e=>{e.exports=require("assert")},4770:e=>{e.exports=require("crypto")},7702:e=>{e.exports=require("events")},2048:e=>{e.exports=require("fs")},2615:e=>{e.exports=require("http")},2694:e=>{e.exports=require("http2")},8791:e=>{e.exports=require("https")},9801:e=>{e.exports=require("os")},5315:e=>{e.exports=require("path")},6162:e=>{e.exports=require("stream")},5346:e=>{e.exports=require("timers")},4175:e=>{e.exports=require("tty")},7360:e=>{e.exports=require("url")},1764:e=>{e.exports=require("util")},1568:e=>{e.exports=require("zlib")},7698:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>R,patchFetch:()=>h,requestAsyncStorage:()=>N,routeModule:()=>p,serverHooks:()=>f,staticGenerationAsyncStorage:()=>S});var i={};r.r(i),r.d(i,{POST:()=>_,dynamic:()=>c,runtime:()=>l});var a=r(9303),n=r(8716),s=r(670),o=r(7070),E=r(5748),u=r(82);let c="force-dynamic",l="nodejs",T=!1;async function d(){T||(await (0,E.D)(),T=!0)}async function _(e){let t=e.headers.get("authorization"),r=process.env.CRON_SECRET;if(r&&t!==`Bearer ${r}`)return o.NextResponse.json({error:"Unauthorized"},{status:401});try{await d();let e=await (0,u.r)();return o.NextResponse.json({ok:!0,itemsIngested:e})}catch(e){return console.error("Cron fetch error:",e),o.NextResponse.json({ok:!1,error:"Feed fetch failed"},{status:500})}}let p=new a.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/cron/fetch-feeds/route",pathname:"/api/cron/fetch-feeds",filename:"route",bundlePath:"app/api/cron/fetch-feeds/route"},resolvedPagePath:"/Users/jeganprakash/Creative/news-rss-feed/src/app/api/cron/fetch-feeds/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:N,staticGenerationAsyncStorage:S,serverHooks:f}=p,R="/api/cron/fetch-feeds/route";function h(){return(0,s.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:S})}},5748:(e,t,r)=>{r.d(t,{D:()=>E,z:()=>o});var i=r(2237);let a=null,n=!1,s=null;function o(){return a||(a=(0,i.qn)(function(){let e=process.env.DATABASE_URL;if(!e){let e=["POSTGRES_URL","POSTGRES_PRISMA_URL","NEON_DATABASE_URL","DATABASE_PATH"].filter(e=>!!process.env[e]),t=e.length>0?` Found ${e.join(", ")} but this app now requires DATABASE_URL explicitly to avoid connecting to the wrong database.`:"";throw Error(`DATABASE_URL is not configured.${t}`)}return e}())),a}async function E(){if(n)return;if(s)return s;let e=o();return s=(async()=>{await e`
      CREATE TABLE IF NOT EXISTS feed_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        published_at TIMESTAMPTZ NOT NULL,
        url_original TEXT,
        url_source TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        normalized_title TEXT NOT NULL
      )
    `,await e`
      CREATE INDEX IF NOT EXISTS idx_created_at ON feed_items(created_at DESC)
    `,await e`
      CREATE INDEX IF NOT EXISTS idx_source ON feed_items(source)
    `,await e`
      CREATE INDEX IF NOT EXISTS idx_url_original ON feed_items(url_original)
    `,await e`
      CREATE INDEX IF NOT EXISTS idx_normalized_title ON feed_items(normalized_title)
    `,await e`
      CREATE TABLE IF NOT EXISTS source_metadata (
        source TEXT PRIMARY KEY,
        last_fetch_time TIMESTAMPTZ,
        last_fetch_status TEXT,
        last_error TEXT
      )
    `,await e`
      INSERT INTO source_metadata (source, last_fetch_time, last_fetch_status, last_error)
      VALUES
        ('REUTERS', NULL, NULL, NULL),
        ('THE_VERGE', NULL, NULL, NULL),
        ('TECHCRUNCH', NULL, NULL, NULL)
      ON CONFLICT (source) DO NOTHING
    `,await e`
      CREATE TABLE IF NOT EXISTS item_rankings (
        item_id TEXT PRIMARY KEY,
        importance_score DOUBLE PRECISION NOT NULL,
        reason TEXT,
        model TEXT NOT NULL,
        ranked_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT fk_item_rankings_item
          FOREIGN KEY (item_id) REFERENCES feed_items(id) ON DELETE CASCADE
      )
    `,await e`
      CREATE INDEX IF NOT EXISTS idx_item_rankings_score ON item_rankings(importance_score DESC)
    `,await e`
      CREATE INDEX IF NOT EXISTS idx_item_rankings_ranked_at ON item_rankings(ranked_at DESC)
    `,n=!0})().finally(()=>{s=null})}},82:(e,t,r)=>{r.d(t,{r:()=>p});var i=r(5367),a=r.n(i),n=r(4263),s=r(4770),o=r(5748);async function E(e,t){let r=(0,o.z)();return(await r`
    SELECT 1 FROM feed_items
    WHERE url_source = ${e} OR url_original = ${e}
    LIMIT 1
  `).length>0||(await r`
    SELECT 1 FROM feed_items
    WHERE normalized_title = ${t}
    LIMIT 1
  `).length>0}let u=new(a()),c={REUTERS:process.env.REUTERS_RSS_URL||"https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen",THE_VERGE:process.env.VERGE_RSS_URL||"https://www.theverge.com/rss/index.xml",TECHCRUNCH:process.env.TECHCRUNCH_RSS_URL||"https://techcrunch.com/feed/"};async function l(e){try{let t=await n.Z.head(e,{maxRedirects:5,timeout:5e3,validateStatus:()=>!0});return t.request?.res?.responseUrl||e}catch{return e}}async function T(e){let t=new AbortController,r=setTimeout(()=>t.abort(),8e3);try{let r=await fetch(e,{method:"GET",signal:t.signal,headers:{"User-Agent":"RSS-Mix-Fetcher/1.0"},cache:"no-store"});if(!r.ok)throw Error(`Feed fetch failed with ${r.status}`);return await r.text()}catch(e){if(e instanceof Error&&"AbortError"===e.name)throw Error("Feed fetch timeout");throw e}finally{clearTimeout(r)}}async function d(e){let t=c[e],r=await T(t),i=await u.parseString(r),a=[];for(let t of(i.items||[]).slice(0,30)){if(!t.title||!t.link)continue;let r=t.link;"REUTERS"!==e||process.env.VERCEL||(r=await l(r)),a.push({title:t.title,link:r,pubDate:t.pubDate||new Date().toISOString(),source:e})}return a}function _(e,t,r){let i=(0,o.z)();return i`
    UPDATE source_metadata
    SET last_fetch_time = ${new Date().toISOString()},
        last_fetch_status = ${t},
        last_error = ${r}
    WHERE source = ${e}
  `.then(()=>void 0)}async function p(){let e=(0,o.z)(),t=0;for(let r of Object.keys(c))try{for(let i of(await d(r))){let a=i.title.toLowerCase().replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim();if(await E(i.link,a))continue;let n=new Date().toISOString();(await e`
          INSERT INTO feed_items
            (id, title, source, published_at, url_original, url_source, created_at, normalized_title)
          VALUES
            (
              ${(0,s.randomUUID)()},
              ${i.title},
              ${i.source},
              ${new Date(i.pubDate).toISOString()},
              ${"REUTERS"===r?i.link:null},
              ${i.link},
              ${n},
              ${a}
            )
          ON CONFLICT DO NOTHING
          RETURNING id
        `).length>0&&t++}await _(r,"ok",null)}catch(t){let e=t instanceof Error?t.message:String(t);console.error(`Failed to fetch ${r}: ${e}`),await _(r,"error",e)}return t}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[276,415,475],()=>r(7698));module.exports=i})();