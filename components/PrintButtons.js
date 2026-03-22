import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { PrintService } from '../lib/printService.js';

const html = htm.bind(h);

export const PrintButtons = () => {
    const [scale, setScale] = useState(1.0);

    return html`
        <div class="flex items-center gap-2 no-print bg-slate-100/50 p-1 rounded-xl border border-slate-200">
            <div class="flex items-center gap-1">
                <button 
                    onClick=${() => PrintService.print('portrait', scale)}
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-900 transition-colors"
                    title="Print Portrait"
                >
                    <span>📄</span> Port.
                </button>
                <button 
                    onClick=${() => PrintService.print('landscape', scale)}
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-700 transition-colors"
                    title="Print Landscape"
                >
                    <span>📑</span> Land.
                </button>
            </div>
            
            <div class="h-6 w-px bg-slate-200 mx-1"></div>
            
            <div class="flex items-center gap-1.5 pr-2">
                <span class="text-[9px] font-black text-slate-400 uppercase hidden sm:inline">Fit:</span>
                <select 
                    value=${scale}
                    onChange=${(e) => setScale(parseFloat(e.target.value))}
                    class="bg-white border border-slate-200 text-slate-700 px-1.5 py-1 rounded-lg text-[10px] font-black outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    title="Change print scale to fit more content on one page"
                >
                    <option value="1.0">100% (Default)</option>
                    <option value="0.95">95% (Tight)</option>
                    <option value="0.9">90% (Condensed)</option>
                    <option value="0.85">85%</option>
                    <option value="0.8">80% (Small)</option>
                    <option value="0.75">75%</option>
                    <option value="0.7">70% (Extra Small)</option>
                    <option value="0.6">60% (Tiny)</option>
                </select>
            </div>
        </div>
    `;
};
