import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Mic,
  FileText,
  Search,
  ArrowLeft,
  Brain,
  Target,
  Download,
  Sparkles
} from 'lucide-react';
import { getDealsBySearch } from '../api/DealService';
import { useNavigate } from 'react-router-dom';


const PAGE_SIZE = 6;

const getStatusColor = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'closed': return 'bg-green-100 text-green-800 border-green-200';
    case 'due_diligence': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'final_review': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'pipeline': return 'bg-purple-100 text-purple-800 border-purple-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};


const SNFalyzeAI = () => {
  const navigate = useNavigate();
  // Deals state
  const [deals, setDeals] = useState([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingDeals, setLoadingDeals] = useState(false);


  // Fetch deals with pagination and search
  useEffect(() => {
    let isMounted = true;
    setLoadingDeals(true);
    getDealsBySearch(searchTerm, page, PAGE_SIZE)
      .then(res => {
        if (!isMounted) return;
        setDeals(res.body.deals || []);
        setTotalDeals(res.body.total || 0);
      })
      .finally(() => {
        if (isMounted) setLoadingDeals(false);
      });
    return () => { isMounted = false; };
  }, [searchTerm, page]);



  // Pagination controls
  const totalPages = Math.ceil(totalDeals / PAGE_SIZE);

  // Deal Selection Screen
 
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 mb-6">
              <div className="w-full ml-auto d-flex justify-content-end align-items-end">
                <Brain size={28} className="bg-purple-500 d-flex text-white rounded-full p-1" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Hello! How can I help you?</h2>
              <p className="text-gray-600">I'm SNFalyze.ai, your M&A deal analysis assistant. Select a deal below to get started with intelligent insights and analysis.</p>
            </div>
          </div>

          {/* Deal Selection */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden px-4 py-4">
            <div className="row pt-2 pb-4 align-items-center">
              <div className="col-lg-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-0">Select a Deal</h3>
              </div>
              <div className="col-lg-6">
                {/* Search */}
                <div className="position-relative">
                  <Search size={20} className="search-ai-icon" />
                  <input
                    type="text"
                    placeholder="Search deals..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    className="search-ai-input"
                  />
                </div>
              </div>
            </div>
            <div className="pt-2">
              {/* Deals Grid */}
              {loadingDeals ? (
                <div className="text-center py-8 col-span-full">
                  <span className="text-gray-500">Loading deals...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {deals.map((deal) => (
                      <div
                        key={deal.id}
                        onClick={()=>{
                          navigate("/ai-deals/chat-interface-ai", { state: { deal: deal } })
                        }}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-purple-50 hover:border-purple-300 cursor-pointer transition-all"
                      >
                        <div className="flex justify-between items-start mb-2 gap-2 deal-heading">
                          <h4 className="">{deal.deal_name || deal.name}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(deal.deal_status || deal.status)}`}>
                            {(deal.deal_status || deal.status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-purple-600">
                          {deal.total_deal_amount ? `$${deal.total_deal_amount.toLocaleString()}` : (deal.value || '-')}
                        </p>
                        {deal.priority_level && (
                          <span className="block text-xs mt-1 text-gray-500">Priority: {deal.priority_level}</span>
                        )}
                        {/* {deal.city && deal.state && (
                          <span className="block text-xs text-gray-400">{deal.city}, {deal.state}</span>
                        )} */}
                      </div>
                    ))}
                  </div>
                  {deals.length === 0 && (
                    <div className="text-center py-8 col-span-full">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No deals found</h3>
                      <p className="text-gray-600">Try adjusting your search terms</p>
                    </div>
                  )}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 pt-5">
                      <button
                        className="px-3 py-1 rounded bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-50"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        Prev
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="px-3 py-1 rounded bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-50 "
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
};

export default SNFalyzeAI;