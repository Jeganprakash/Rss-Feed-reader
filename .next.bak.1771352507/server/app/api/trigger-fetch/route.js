"use strict";(()=>{var e={};e.id=177,e.ids=[177],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7790:e=>{e.exports=require("assert")},4770:e=>{e.exports=require("crypto")},7702:e=>{e.exports=require("events")},2048:e=>{e.exports=require("fs")},2615:e=>{e.exports=require("http")},2694:e=>{e.exports=require("http2")},8791:e=>{e.exports=require("https")},9801:e=>{e.exports=require("os")},5315:e=>{e.exports=require("path")},6162:e=>{e.exports=require("stream")},5346:e=>{e.exports=require("timers")},4175:e=>{e.exports=require("tty")},7360:e=>{e.exports=require("url")},1764:e=>{e.exports=require("util")},1568:e=>{e.exports=require("zlib")},7449:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>O,patchFetch:()=>A,requestAsyncStorage:()=>N,routeModule:()=>g,serverHooks:()=>L,staticGenerationAsyncStorage:()=>h});var i={};r.r(i),r.d(i,{POST:()=>R,dynamic:()=>u,runtime:()=>_});var a=r(9303),n=r(8716),s=r(670),o=r(7070),l=r(5748),c=r(82),E=r(3947);let u="force-dynamic",_="nodejs",d=!1,m=!1,T=0;async function S(){d||(await (0,l.D)(),d=!0)}function f(e,t){return o.NextResponse.json(e,{...t,headers:{...t?.headers,"Cache-Control":"no-store"}})}async function p(){if(m)return f({ok:!1,error:"Feed pull is already running. Please wait."},{status:409});let e=Date.now(),t=e-T;if(t<6e4){let e=Math.ceil((6e4-t)/1e3);return f({ok:!1,error:`Please wait ${e}s before pulling again.`,retryAfterSeconds:e},{status:429,headers:{"Retry-After":String(e)}})}m=!0,T=e;try{await S();let e=await (0,c.r)(),t=await (0,E.w)({limit:20});return f({ok:!0,itemsIngested:e,message:"Feed pull completed successfully",items:t.items,nextCursor:t.nextCursor,hasMore:t.hasMore})}catch(e){return console.error("Manual fetch error:",e),f({ok:!1,error:"Feed fetch failed"},{status:500})}finally{m=!1}}async function R(){return p()}let g=new a.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/trigger-fetch/route",pathname:"/api/trigger-fetch",filename:"route",bundlePath:"app/api/trigger-fetch/route"},resolvedPagePath:"/Users/jeganprakash/Creative/news-rss-feed/src/app/api/trigger-fetch/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:N,staticGenerationAsyncStorage:h,serverHooks:L}=g,O="/api/trigger-fetch/route";function A(){return(0,s.patchFetch)({serverHooks:L,staticGenerationAsyncStorage:h})}},5748:(e,t,r)=>{r.d(t,{D:()=>l,z:()=>o});var i=r(2237);let a=null,n=!1,s=null;function o(){return a||(a=(0,i.qn)(function(){let e=process.env.DATABASE_URL;if(!e){let e=["POSTGRES_URL","POSTGRES_PRISMA_URL","NEON_DATABASE_URL","DATABASE_PATH"].filter(e=>!!process.env[e]),t=e.length>0?` Found ${e.join(", ")} but this app now requires DATABASE_URL explicitly to avoid connecting to the wrong database.`:"";throw Error(`DATABASE_URL is not configured.${t}`)}return e}())),a}async function l(){if(n)return;if(s)return s;let e=o();return s=(async()=>{await e`
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
    `,n=!0})().finally(()=>{s=null})}},3947:(e,t,r)=>{r.d(t,{w:()=>o});var i=r(5748);let a=["REUTERS","THE_VERGE","TECHCRUNCH"];function n(e){return e?e instanceof Date?e.toISOString():e:null}function s(e){return{id:e.id,title:e.title,source:function(e){let t=e.toUpperCase().replace(/[^A-Z]/g,"");return t.includes("REUTERS")?"REUTERS":t.includes("VERGE")?"THE_VERGE":t.includes("TECHCRUNCH")?"TECHCRUNCH":"REUTERS"}(e.source),publishedAt:n(e.published_at)||new Date(0).toISOString(),urlOriginal:e.url_original||null,urlSource:e.url_source,createdAt:n(e.created_at)||new Date(0).toISOString(),normalizedTitle:e.normalized_title,importanceScore:function(e){if("number"==typeof e)return e;if("string"==typeof e){let t=Number(e);return Number.isFinite(t)?t:null}return null}(e.importance_score),importanceReason:e.importance_reason||null,rankedAt:n(e.ranked_at)}}async function o(e={}){let t=(0,i.z)(),r=Math.min(Math.max(e.limit||20,1),50),o=null;if(e.cursor){let r=(await t`
      SELECT created_at FROM feed_items WHERE id = ${e.cursor} LIMIT 1
    `)[0];o=n(r?.created_at||null)}let l=new Map;for(let e of a){let i;i=o?await t`
        SELECT feed_items.*,
               item_rankings.importance_score AS importance_score,
               item_rankings.reason AS importance_reason,
               item_rankings.ranked_at AS ranked_at
        FROM feed_items
        LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
        WHERE feed_items.source = ${e} AND feed_items.created_at < ${o}
        ORDER BY feed_items.created_at DESC,
                 COALESCE(item_rankings.importance_score, 50) DESC
        LIMIT ${r}
      `:await t`
        SELECT feed_items.*,
               item_rankings.importance_score AS importance_score,
               item_rankings.reason AS importance_reason,
               item_rankings.ranked_at AS ranked_at
        FROM feed_items
        LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
        WHERE feed_items.source = ${e}
        ORDER BY feed_items.created_at DESC,
                 COALESCE(item_rankings.importance_score, 50) DESC
        LIMIT ${r}
      `,l.set(e,i.map(s))}let c=[],E=new Map(a.map(e=>[e,0]));for(;c.length<r;){let e=[...a].sort((e,t)=>{let r=E.get(e)||0,i=E.get(t)||0,a=l.get(e)?.[r]?.importanceScore??50,n=l.get(t)?.[i]?.importanceScore??50;return a===n?Math.random()-.5:n-a}),t=!1;for(let i of e){if(c.length>=r)break;let e=l.get(i)||[],a=E.get(i)||0;a<e.length&&(c.push(e[a]),E.set(i,a+1),t=!0)}if(!t)break}if(0===c.length){let e=o?await t`
          SELECT feed_items.*,
                 item_rankings.importance_score AS importance_score,
                 item_rankings.reason AS importance_reason,
                 item_rankings.ranked_at AS ranked_at
          FROM feed_items
          LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
          WHERE feed_items.created_at < ${o}
          ORDER BY feed_items.created_at DESC,
                   COALESCE(item_rankings.importance_score, 50) DESC
          LIMIT ${r}
        `:await t`
          SELECT feed_items.*,
                 item_rankings.importance_score AS importance_score,
                 item_rankings.reason AS importance_reason,
                 item_rankings.ranked_at AS ranked_at
          FROM feed_items
          LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
          ORDER BY feed_items.created_at DESC,
                   COALESCE(item_rankings.importance_score, 50) DESC
          LIMIT ${r}
        `;c.push(...e.map(s))}let u=c[c.length-1],_=u?.id||null,d=!1;return u&&(d=(await t`
      SELECT 1 FROM feed_items
      WHERE created_at < ${u.createdAt}
      LIMIT 1
    `).length>0),{items:c,nextCursor:_,hasMore:d}}},82:(e,t,r)=>{r.d(t,{r:()=>T});var i=r(5367),a=r.n(i),n=r(4263),s=r(4770),o=r(5748);async function l(e,t){let r=(0,o.z)();return(await r`
    SELECT 1 FROM feed_items
    WHERE url_source = ${e} OR url_original = ${e}
    LIMIT 1
  `).length>0||(await r`
    SELECT 1 FROM feed_items
    WHERE normalized_title = ${t}
    LIMIT 1
  `).length>0}let c=new(a()),E={REUTERS:process.env.REUTERS_RSS_URL||"https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen",THE_VERGE:process.env.VERGE_RSS_URL||"https://www.theverge.com/rss/index.xml",TECHCRUNCH:process.env.TECHCRUNCH_RSS_URL||"https://techcrunch.com/feed/"};async function u(e){try{let t=await n.Z.head(e,{maxRedirects:5,timeout:5e3,validateStatus:()=>!0});return t.request?.res?.responseUrl||e}catch{return e}}async function _(e){let t=new AbortController,r=setTimeout(()=>t.abort(),8e3);try{let r=await fetch(e,{method:"GET",signal:t.signal,headers:{"User-Agent":"RSS-Mix-Fetcher/1.0"},cache:"no-store"});if(!r.ok)throw Error(`Feed fetch failed with ${r.status}`);return await r.text()}catch(e){if(e instanceof Error&&"AbortError"===e.name)throw Error("Feed fetch timeout");throw e}finally{clearTimeout(r)}}async function d(e){let t=E[e],r=await _(t),i=await c.parseString(r),a=[];for(let t of(i.items||[]).slice(0,30)){if(!t.title||!t.link)continue;let r=t.link;"REUTERS"!==e||process.env.VERCEL||(r=await u(r)),a.push({title:t.title,link:r,pubDate:t.pubDate||new Date().toISOString(),source:e})}return a}function m(e,t,r){let i=(0,o.z)();return i`
    UPDATE source_metadata
    SET last_fetch_time = ${new Date().toISOString()},
        last_fetch_status = ${t},
        last_error = ${r}
    WHERE source = ${e}
  `.then(()=>void 0)}async function T(){let e=(0,o.z)(),t=0;for(let r of Object.keys(E))try{for(let i of(await d(r))){let a=i.title.toLowerCase().replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim();if(await l(i.link,a))continue;let n=new Date().toISOString();(await e`
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
        `).length>0&&t++}await m(r,"ok",null)}catch(t){let e=t instanceof Error?t.message:String(t);console.error(`Failed to fetch ${r}: ${e}`),await m(r,"error",e)}return t}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[276,415,475],()=>r(7449));module.exports=i})();