"use strict";(()=>{var e={};e.id=749,e.ids=[749],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},9838:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>R,patchFetch:()=>L,requestAsyncStorage:()=>N,routeModule:()=>S,serverHooks:()=>p,staticGenerationAsyncStorage:()=>f});var i={};r.r(i),r.d(i,{GET:()=>u,dynamic:()=>d,runtime:()=>c});var a=r(9303),n=r(8716),s=r(670),o=r(7070),_=r(5748),E=r(3947);let d="force-dynamic",c="nodejs",m=!1;async function T(){m||(await (0,_.D)(),m=!0)}function l(e,t){return o.NextResponse.json(e,{...t,headers:{...t?.headers,"Cache-Control":"no-store"}})}async function u(e){try{await T();let{searchParams:t}=e.nextUrl,r=t.get("cursor")||void 0,i=t.get("limit"),a=i?parseInt(i,10):20;if(i&&(isNaN(a)||a<1||a>50))return l({error:"limit must be between 1 and 50"},{status:400});let n=await (0,E.w)({cursor:r,limit:a});return l(n)}catch(e){return console.error("Feed API error:",e),l({error:"Internal server error"},{status:500})}}let S=new a.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/feed/route",pathname:"/api/feed",filename:"route",bundlePath:"app/api/feed/route"},resolvedPagePath:"/Users/jeganprakash/Creative/news-rss-feed/src/app/api/feed/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:N,staticGenerationAsyncStorage:f,serverHooks:p}=S,R="/api/feed/route";function L(){return(0,s.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:f})}},5748:(e,t,r)=>{r.d(t,{D:()=>_,z:()=>o});var i=r(2237);let a=null,n=!1,s=null;function o(){return a||(a=(0,i.qn)(function(){let e=process.env.DATABASE_URL;if(!e){let e=["POSTGRES_URL","POSTGRES_PRISMA_URL","NEON_DATABASE_URL","DATABASE_PATH"].filter(e=>!!process.env[e]),t=e.length>0?` Found ${e.join(", ")} but this app now requires DATABASE_URL explicitly to avoid connecting to the wrong database.`:"";throw Error(`DATABASE_URL is not configured.${t}`)}return e}())),a}async function _(){if(n)return;if(s)return s;let e=o();return s=(async()=>{await e`
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
    `)[0];o=n(r?.created_at||null)}let _=new Map;for(let e of a){let i;i=o?await t`
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
      `,_.set(e,i.map(s))}let E=[],d=new Map(a.map(e=>[e,0]));for(;E.length<r;){let e=[...a].sort((e,t)=>{let r=d.get(e)||0,i=d.get(t)||0,a=_.get(e)?.[r]?.importanceScore??50,n=_.get(t)?.[i]?.importanceScore??50;return a===n?Math.random()-.5:n-a}),t=!1;for(let i of e){if(E.length>=r)break;let e=_.get(i)||[],a=d.get(i)||0;a<e.length&&(E.push(e[a]),d.set(i,a+1),t=!0)}if(!t)break}if(0===E.length){let e=o?await t`
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
        `;E.push(...e.map(s))}let c=E[E.length-1],m=c?.id||null,T=!1;return c&&(T=(await t`
      SELECT 1 FROM feed_items
      WHERE created_at < ${c.createdAt}
      LIMIT 1
    `).length>0),{items:E,nextCursor:m,hasMore:T}}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),i=t.X(0,[276,415],()=>r(9838));module.exports=i})();