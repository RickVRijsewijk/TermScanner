'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  FileText, 
  Scale, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Link as LinkIcon,
  Loader2,
  ArrowRight,
  Sparkles,
  Download,
  Save,
  FolderOpen,
  Trash2,
  X,
  Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type Risk = {
  title: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  quote?: string;
};

type DataUsage = {
  category: string;
  purpose: string;
  quote?: string;
};

type Compliance = {
  regulation: string;
  status: 'Compliant' | 'Non-Compliant' | 'Unclear';
  details: string;
  quote?: string;
};

type AnalysisResult = {
  summary: string;
  dataUsage: DataUsage[];
  risks: Risk[];
  compliance: Compliance[];
  score: number;
};

type SavedAnalysis = {
  id: string;
  date: string;
  title: string;
  result: AnalysisResult;
  analyzedText: string;
  analyzedUrl: string;
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [inputType, setInputType] = useState<'url' | 'text'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzedText, setAnalyzedText] = useState('');
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [activeQuote, setActiveQuote] = useState<{text: string, type: 'risk' | 'data' | 'compliance'} | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSavedModal, setShowSavedModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('termscanner_saved');
    if (saved) {
      try {
        setSavedAnalyses(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved analyses', e);
      }
    }
  }, []);

  const saveAnalysis = () => {
    if (!result) return;
    
    const newSave: SavedAnalysis = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      title: analyzedUrl ? new URL(analyzedUrl).hostname : 'Pasted Text Analysis',
      result,
      analyzedText,
      analyzedUrl
    };

    const updated = [newSave, ...savedAnalyses];
    setSavedAnalyses(updated);
    localStorage.setItem('termscanner_saved', JSON.stringify(updated));
  };

  const deleteSaved = (id: string) => {
    const updated = savedAnalyses.filter(s => s.id !== id);
    setSavedAnalyses(updated);
    localStorage.setItem('termscanner_saved', JSON.stringify(updated));
  };

  const loadSaved = (saved: SavedAnalysis) => {
    setResult(saved.result);
    setAnalyzedText(saved.analyzedText);
    setAnalyzedUrl(saved.analyzedUrl);
    if (saved.analyzedUrl) {
      setInputType('url');
      setUrl(saved.analyzedUrl);
    } else {
      setInputType('text');
      setText(saved.analyzedText);
    }
    setShowSavedModal(false);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputType === 'url' && !url) return;
    if (inputType === 'text' && !text) return;

    let finalUrl = url;
    if (inputType === 'url' && url && !/^https?:\/\//i.test(url)) {
      finalUrl = `https://${url}`;
      setUrl(finalUrl);
    }

    setLoading(true);
    setError('');
    setResult(null);

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: inputType === 'url' ? finalUrl : undefined,
            text: inputType === 'text' ? text : undefined
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to analyze document');
        }

        setAnalyzedText(data.text);
        if (data.finalUrl && data.finalUrl !== finalUrl) {
          setAnalyzedUrl(data.finalUrl);
        } else {
          setAnalyzedUrl(inputType === 'url' ? finalUrl : '');
        }
        setResult(data.analysis);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getComplianceIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'compliant': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'non-compliant': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default: return <Info className="w-5 h-5 text-yellow-600" />;
    }
  };

  const DocumentViewer = ({ text, activeQuote }: { text: string, activeQuote: { text: string, type: string } | null }) => {
    const highlightRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (highlightRef.current) {
        // Add a small delay to ensure React has finished rendering the mark elements
        setTimeout(() => {
          highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    }, [activeQuote]);

    if (!activeQuote || !activeQuote.text) {
      return <div className="whitespace-pre-wrap text-sm text-slate-600 font-mono leading-relaxed">{text}</div>;
    }

    const buildFlexibleRegex = (quote: string) => {
      // Escape special regex characters
      let escaped = quote.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Make whitespace flexible (match any amount of whitespace/newlines)
      escaped = escaped.replace(/\s+/g, '\\s+');
      // Make quotes flexible (match any type of quote)
      escaped = escaped.replace(/['"“”‘’`]/g, '[\'\\"“”‘’`]');
      // Handle ellipses that Gemini might add
      escaped = escaped.replace(/\\\.\\\.\\\./g, '[\\s\\S]{0,200}');
      return new RegExp(`(${escaped})`, 'gi');
    };

    let regex = buildFlexibleRegex(activeQuote.text);
    let parts = text.split(regex);

    // Fallback: If exact/flexible match fails, try matching just the first half of the quote
    if (parts.length === 1 && activeQuote.text.length > 30) {
      const halfQuote = activeQuote.text.substring(0, Math.floor(activeQuote.text.length / 2));
      regex = buildFlexibleRegex(halfQuote);
      parts = text.split(regex);
      
      // Fallback 2: Try just the first 20 characters
      if (parts.length === 1) {
        const shortQuote = activeQuote.text.substring(0, 20);
        regex = buildFlexibleRegex(shortQuote);
        parts = text.split(regex);
      }
    }

    // If still no match found, just return the text
    if (parts.length === 1) {
      return <div className="whitespace-pre-wrap text-sm text-slate-600 font-mono leading-relaxed">{text}</div>;
    }

    const highlightColor = 
      activeQuote.type === 'risk' ? 'bg-red-200 text-red-900 border-red-400' :
      activeQuote.type === 'data' ? 'bg-purple-200 text-purple-900 border-purple-400' :
      'bg-emerald-200 text-emerald-900 border-emerald-400';

    let firstMatchFound = false;

    return (
      <div className="whitespace-pre-wrap text-sm text-slate-600 font-mono leading-relaxed">
        {parts.map((part, i) => {
          // Because we have one capturing group in our regex, every odd index (1, 3, 5...) is a match
          if (i % 2 !== 0) {
            const isFirst = !firstMatchFound;
            firstMatchFound = true;
            return (
              <mark 
                key={i} 
                ref={isFirst ? highlightRef : null} 
                className={`rounded px-1 border-b-2 ${highlightColor}`}
              >
                {part}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  const exportJSON = () => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "privacy_analysis.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportCSV = () => {
    if (!result) return;
    
    // Helper to escape CSV fields
    const escapeCSV = (field: string | undefined) => {
      if (!field) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Section,Item,Details,Severity/Status\n";
    csvContent += `Score,,${escapeCSV(String(result.score))},\n`;
    csvContent += `Summary,,${escapeCSV(result.summary)},\n`;
    
    result.risks.forEach(r => {
      csvContent += `Risk,${escapeCSV(r.title)},${escapeCSV(r.description)},${escapeCSV(r.severity)}\n`;
    });
    
    result.dataUsage.forEach(d => {
      csvContent += `Data Usage,${escapeCSV(d.category)},${escapeCSV(d.purpose)},\n`;
    });
    
    result.compliance.forEach(c => {
      csvContent += `Compliance,${escapeCSV(c.regulation)},${escapeCSV(c.details)},${escapeCSV(c.status)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "privacy_analysis.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getRiskChartData = () => {
    if (!result) return [];
    const counts = { High: 0, Medium: 0, Low: 0 };
    result.risks.forEach(r => {
      if (counts[r.severity] !== undefined) counts[r.severity]++;
    });
    return [
      { name: 'High', count: counts.High, fill: '#ef4444' },
      { name: 'Medium', count: counts.Medium, fill: '#f59e0b' },
      { name: 'Low', count: counts.Low, fill: '#10b981' },
    ].filter(d => d.count > 0);
  };

  const getDataUsageChartData = () => {
    if (!result) return [];
    const counts = result.dataUsage.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    }));
  };

  const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#14b8a6', '#84cc16'];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-lg tracking-tight">
            <ShieldCheck className="w-6 h-6" />
            TermScanner
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSavedModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Saved Analyses
              {savedAnalyses.length > 0 && (
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                  {savedAnalyses.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              <Sparkles className="w-4 h-4 text-blue-500" />
              Powered by Gemini
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Understand what you&apos;re agreeing to.
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Instantly analyze Privacy Policies and Terms of Service. Uncover hidden risks, check compliance, and see exactly how your data is used.
          </p>

          {/* Input Form */}
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
            <div className="flex gap-2 mb-2 p-1 bg-slate-50 rounded-xl w-fit mx-auto">
              <button
                onClick={() => setInputType('url')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  inputType === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Link
              </button>
              <button
                onClick={() => setInputType('text')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  inputType === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Paste Text
              </button>
            </div>

            <form onSubmit={handleAnalyze} className="flex flex-col gap-3 p-2">
              {inputType === 'url' ? (
                <div className="relative flex items-center">
                  <LinkIcon className="absolute left-4 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="example.com/privacy"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the policy text here..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[120px] resize-y"
                  required
                />
              )}
              <button
                type="submit"
                disabled={loading || (inputType === 'url' ? !url : !text)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Document...
                  </>
                ) : (
                  <>
                    Analyze Policy
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3 text-left max-w-2xl mx-auto"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
        </div>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-2xl mx-auto text-center py-12"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-6 relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute inset-0 border-2 border-blue-200 border-t-blue-600 rounded-full"
                />
                <ShieldAlert className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Reading the fine print...</h3>
              <p className="text-slate-500 text-sm">Gemini is analyzing the document for risks and compliance issues.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Export Actions */}
            <div className="flex justify-end gap-3">
              <button 
                onClick={saveAnalysis}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 text-blue-700 transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Analysis
              </button>
              <button 
                onClick={exportJSON}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
              <button 
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Analysis (Scrollable) */}
              <div className="lg:col-span-7 space-y-6 lg:h-[800px] lg:overflow-y-auto pr-2 custom-scrollbar">
              {/* Score & Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Privacy Score</h3>
                  <div className={`text-6xl font-bold tracking-tighter mb-2 ${getScoreColor(result.score)}`}>
                    {result.score}
                  </div>
                  <p className="text-sm text-slate-500">out of 100</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-4 text-slate-900 font-semibold">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <h3>Executive Summary</h3>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* Risks */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-6 text-slate-900 font-semibold">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <h3>Potential Risks</h3>
                </div>
                {result.risks.length > 0 ? (
                  <>
                    <div className="h-48 w-full mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getRiskChartData()} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={60} />
                          <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                            {getRiskChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-4">
                      {result.risks.map((risk, i) => (
                      <div 
                        key={i} 
                        className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-red-300 transition-colors"
                        onMouseEnter={() => risk.quote && setActiveQuote({ text: risk.quote, type: 'risk' })}
                        onMouseLeave={() => setActiveQuote(null)}
                      >
                        <div className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${getSeverityColor(risk.severity)}`}>
                          {risk.severity}
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900 mb-1">{risk.title}</h4>
                          <p className="text-sm text-slate-600">{risk.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 italic">No major risks identified in this document.</p>
                )}
              </div>

              {/* Data Usage */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-6 text-slate-900 font-semibold">
                  <Database className="w-5 h-5 text-purple-500" />
                  <h3>Data Collection & Usage</h3>
                </div>
                {result.dataUsage.length > 0 ? (
                  <>
                    <div className="h-48 w-full mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getDataUsageChartData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {getDataUsageChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {result.dataUsage.map((data, i) => (
                        <div 
                          key={i} 
                          className="p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-purple-300 transition-colors"
                          onMouseEnter={() => data.quote && setActiveQuote({ text: data.quote, type: 'data' })}
                          onMouseLeave={() => setActiveQuote(null)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[getDataUsageChartData().findIndex(d => d.name === data.category) % PIE_COLORS.length] }} />
                            <h4 className="font-medium text-slate-900 text-sm">{data.category}</h4>
                          </div>
                          <p className="text-sm text-slate-600">{data.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 italic">No data usage information found.</p>
                )}
              </div>

              {/* Compliance */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-6 text-slate-900 font-semibold">
                  <Scale className="w-5 h-5 text-emerald-500" />
                  <h3>Regulatory Compliance</h3>
                </div>
                <div className="space-y-4">
                  {result.compliance.map((comp, i) => (
                    <div 
                      key={i} 
                      className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-300 transition-colors"
                      onMouseEnter={() => comp.quote && setActiveQuote({ text: comp.quote, type: 'compliance' })}
                      onMouseLeave={() => setActiveQuote(null)}
                    >
                      <div className="shrink-0 mt-0.5">
                        {getComplianceIcon(comp.status)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">{comp.regulation}</h4>
                          <span className="text-xs font-medium text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">
                            {comp.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{comp.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Original Document */}
            <div className="lg:col-span-5">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:h-[800px] flex flex-col">
                <div className="flex items-center gap-2 mb-4 text-slate-900 font-semibold pb-4 border-b border-slate-100 shrink-0">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <h3>Original Document</h3>
                  {analyzedUrl && (
                    <a href={analyzedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline ml-2 truncate max-w-[200px]">
                      ({analyzedUrl})
                    </a>
                  )}
                  <span className="ml-auto text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    Hover items to highlight
                  </span>
                </div>
                <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                  <DocumentViewer text={analyzedText} activeQuote={activeQuote} />
                </div>
              </div>
            </div>
          </div>
          </motion.div>
        )}
      </main>

      {/* Saved Analyses Modal */}
      <AnimatePresence>
        {showSavedModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSavedModal(false)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <FolderOpen className="w-5 h-5 text-blue-500" />
                  Saved Analyses
                </div>
                <button
                  onClick={() => setShowSavedModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {savedAnalyses.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FolderOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p>No saved analyses yet.</p>
                    <p className="text-sm mt-1">Analyze a document and click "Save Analysis" to keep it here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedAnalyses.map((saved) => (
                      <div 
                        key={saved.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all bg-white group"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => loadSaved(saved)}
                        >
                          <h4 className="font-medium text-slate-900 mb-1 flex items-center gap-2">
                            {saved.title}
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              saved.result.score >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                              saved.result.score >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              Score: {saved.result.score}
                            </span>
                          </h4>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(saved.date).toLocaleDateString()} {new Date(saved.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            <span className="flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              {saved.result.risks.length} Risks
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSaved(saved.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete saved analysis"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
