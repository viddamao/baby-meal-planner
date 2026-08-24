import { useEffect, useMemo, useState } from "react";
import { Download, Plus, RefreshCw, Settings, Trash2, Upload, ChevronDown, ChevronUp, Check } from "lucide-react";
import { loadData, saveData, downloadJson } from "./db";
import { generateDay, substitutions } from "./planner";
import type { AppData, Availability, FoodState, Location, Meal } from "./types";

function App() {
  const [data,setData] = useState<AppData|null>(null);
  const [tab,setTab] = useState<"planner"|"inventory"|"history"|"settings">("planner");
  const [detail,setDetail] = useState(false);
  const [dayMeals,setDayMeals] = useState<Meal[]>([]);
  const [expanded,setExpanded] = useState<Record<string,boolean>>({});
  const [loading,setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0,10));

  useEffect(()=>{ loadData().then(d=>{setData(d);setLoading(false)}); },[]);
  useEffect(()=>{ if(data) saveData(data); },[data]);

  const foodMap = useMemo(()=>new Map((data?.foods ?? []).map(f=>[f.id,f])),[data]);
  const update = (fn:(d:AppData)=>AppData) => setData(d=>d ? fn(structuredClone(d)) : d);

  function makeDay() {
    if (!data) return;
    setDayMeals(generateDay(data, today));
    setExpanded({});
  }

  function markEaten(meal: Meal) {
    if(!data) return;
    const exists = data.history.some(m=>m.id===meal.id && m.date===meal.date);
    if(exists) return;
    update(d=>({...d, history:[...d.history,{...meal,eaten:true}]}));
    setDayMeals((meals: Meal[]) =>
      meals.map((m: Meal) => m.id === meal.id ? { ...m, eaten: true } : m)
    );
  }

  function replaceMeal(meal: Meal, replacement: Meal) {
    setDayMeals((meals: Meal[]) =>
      meals.map((m: Meal) => m.id === meal.id ? replacement : m)
    );
    setExpanded(x=>({...x,[meal.id]:false}));
  }

  function addInventory() {
    if(!data) return;
    const available = data.foods.filter(f=>!data.inventory.some(i=>i.foodId===f.id));
    if(!available.length) return;
    const f=available[0];
    update(d=>({...d,inventory:[...d.inventory,{id:crypto.randomUUID(),foodId:f.id,location:f.category==="fruit"?"fridge":"fridge"}]}));
  }

  function removeInventory(id:string) { update(d=>({...d,inventory:d.inventory.filter(i=>i.id!==id)})); }
  function changeInventory(id:string, patch:Partial<{location:Location,state:FoodState,availability:Availability}>) {
    update(d=>({...d,inventory:d.inventory.map(i=>i.id===id?{...i,...patch}:i)}));
  }

  function importData(file:File) {
    const reader=new FileReader();
    reader.onload=()=>{ try {
      const parsed=JSON.parse(String(reader.result));
      if (
        parsed.version === 1 &&
        Array.isArray(parsed.foods) &&
        Array.isArray(parsed.inventory) &&
        Array.isArray(parsed.history)
      ) {
        const normalized = {
          ...parsed,
          history: parsed.history.map((m: any) => ({
            ...m,
            protein: Array.isArray(m.protein) ? m.protein : typeof m.protein === "string" ? [m.protein] : [],
            vegetables: Array.isArray(m.vegetables) ? m.vegetables : typeof m.vegetables === "string" ? [m.vegetables] : [],
            fruit: Array.isArray(m.fruit) ? m.fruit : typeof m.fruit === "string" ? [m.fruit] : []
          }))
        };
        setData(normalized);
      } else alert("That file doesn't look like a Layla Meal Planner backup.");
    } catch { alert("Couldn't read that JSON file."); } };
    reader.readAsText(file);
  }

  if(loading || !data) return <div className="loading">Loading…</div>;

  return <div className="app">
    <header>
      <div>
        <div className="eyebrow">LAYLA</div>
        <h1>Meal Planner</h1>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={()=>setTab("settings")} title="Settings"><Settings size={18}/></button>
      </div>
    </header>

    <nav className="tabs">
      {(["planner","inventory","history","settings"] as const).map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}
    </nav>

    {tab==="planner" && <main>
      <section className="hero-row">
        <div>
          <p className="eyebrow">TODAY</p>
          <h2>{formatDate(today)}</h2>
          <p className="muted">Two simple meals based on what you have and what Layla has eaten recently.</p>
        </div>
        <button className="primary" onClick={makeDay}><RefreshCw size={17}/> Generate today's meals</button>
      </section>
      {dayMeals.length===0 ? <div className="empty">
        <div className="empty-icon">🍽️</div>
        <h3>Ready when you are</h3>
        <p>Generate lunch and dinner from the current inventory and meal history.</p>
        <button className="primary" onClick={makeDay}>Generate today's meals</button>
      </div> :
      <div className="today-grid">
        {dayMeals.map(m=>
          <MealCard
            key={m.id}
            meal={m}
            data={data}
            foodMap={foodMap}
            expanded={!!expanded[m.id]}
            onToggle={()=>setExpanded(x=>({...x,[m.id]:!x[m.id]}))}
            onEaten={()=>markEaten(m)}
            onReplace={r=>replaceMeal(m,r)}
          />
        )}
      </div>}
      {dayMeals.length>0 && <section className="recent-section">
        <div className="eyebrow">RECENT MEALS</div>
        <p className="muted">The planner uses this history to avoid repetitive combinations.</p>
        <div className="recent-list">
          {[...data.history].slice(-5).reverse().map((m: Meal) =>
            <div className="recent-row" key={m.id}>
              <span>{formatDate(m.date)}</span>
              <strong>{formatMeal(m,foodMap)}</strong>
            </div>
          )}
        </div>
      </section>}
    </main>}

    {tab==="inventory" && <main>
      <section className="hero-row">
        <div><p className="eyebrow">CURRENT FOOD</p><h2>Inventory</h2><p className="muted">Keep it rough. No counting required.</p></div>
        <div className="toggle"><button className={!detail?"selected":""} onClick={()=>setDetail(false)}>Simple</button><button className={detail?"selected":""} onClick={()=>setDetail(true)}>Detailed</button></div>
      </section>
      <div className="inventory-grid">
        {(["fridge","freezer"] as Location[]).map(loc=><section className="panel" key={loc}>
          <h3>{loc==="fridge"?"Fridge":"Freezer"}</h3>
          {data.inventory.filter(i=>i.location===loc).map(item=>{
            const f=foodMap.get(item.foodId)!;
            return <div className="inventory-row" key={item.id}>
              <span className="food-name">{f.name}</span>
              {detail && <div className="details">
                <select value={item.availability??""} onChange={e=>changeInventory(item.id,{availability:(e.target.value||undefined) as Availability|undefined})}>
                  <option value="">Normal</option><option value="plenty">Plenty</option><option value="some">Some</option><option value="use-soon">Use soon</option>
                </select>
                {loc==="freezer" && <select value={item.state??""} onChange={e=>changeInventory(item.id,{state:(e.target.value||undefined) as FoodState|undefined})}>
                  <option value="">State</option><option value="raw">Raw</option><option value="cooked">Cooked</option>
                </select>}
              </div>}
              <button className="icon-btn subtle" onClick={()=>removeInventory(item.id)} title="Remove"><Trash2 size={16}/></button>
            </div>
          })}
          {data.inventory.filter(i=>i.location===loc).length===0 && <p className="muted">Nothing listed.</p>}
        </section>)}
      </div>
      <button className="secondary add-btn" onClick={addInventory}><Plus size={17}/> Add food</button>
    </main>}

    {tab==="history" && <main>
      <section className="hero-row"><div><p className="eyebrow">PAST MEALS</p><h2>History</h2><p className="muted">{data.history.length} meals recorded. We'll import Kaidi's notes here tomorrow.</p></div></section>
      <div className="history-list">{[...data.history].reverse().map(m=><div className="history-row" key={m.id}>
        <div><strong>{new Date(`${m.date}T12:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</strong><span>{m.slot}</span></div>
        <p>{formatMeal(m,foodMap)}</p>
      </div>)}</div>
    </main>}

    {tab==="settings" && <main>
      <section className="hero-row"><div><p className="eyebrow">DATA</p><h2>Settings</h2><p className="muted">Everything is stored locally in this browser.</p></div></section>
      <div className="panel settings-panel">
        <h3>Backup & restore</h3>
        <p className="muted">Export a JSON backup if you want to move the planner to another browser or computer.</p>
        <div className="settings-actions">
          <button className="secondary" onClick={()=>downloadJson(data)}><Download size={17}/> Export data</button>
          <label className="secondary file-btn"><Upload size={17}/> Import data<input type="file" accept="application/json" onChange={e=>{const f=e.target.files?.[0]; if(f) importData(f)}} /></label>
        </div>
      </div>
    </main>}
  </div>;
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function formatMeal(m:Meal,map:Map<string,{name:string}>) {
  return [...m.protein.map(id=>map.get(id)?.name),...m.vegetables.map(id=>map.get(id)?.name),...m.fruit.map(id=>map.get(id)?.name)].filter(Boolean).join(" · ");
}

function MealCard({meal,data,foodMap,expanded,onToggle,onEaten,onReplace}:{meal:Meal;data:AppData;foodMap:Map<string,{name:string}>;expanded:boolean;onToggle:()=>void;onEaten:()=>void;onReplace:(m:Meal)=>void}) {
  const alts=expanded?substitutions(meal,data,[]):[];
  return <article className="meal-card">
    <div className="meal-top"><span className="meal-slot">{meal.slot}</span>{meal.eaten && <span className="eaten"><Check size={13}/> eaten</span>}</div>
    <div className="meal-main">
      <div className="meal-title">
        <strong>{meal.protein.map(id=>foodMap.get(id)?.name).join(" + ")}</strong>
        <span>·</span><span>{meal.vegetables.map(id=>foodMap.get(id)?.name).join(" + ")}</span><span>·</span><span>{meal.fruit.map(id=>foodMap.get(id)?.name).join(" + ")}</span>
      </div>
    </div>
    <div className="meal-actions">
      {!meal.eaten && <button onClick={onEaten}><Check size={14}/> Mark eaten</button>}
      <button onClick={onToggle}>{expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>} {expanded?"Hide":"Substitutions"}</button>
    </div>
    {expanded && <div className="alternatives">{alts.map((a,i)=><button key={i} className="alternative" onClick={()=>onReplace(a)}><span>Option {i+1}</span><strong>{formatMeal(a,foodMap)}</strong></button>)}</div>}
  </article>
}

export default App;