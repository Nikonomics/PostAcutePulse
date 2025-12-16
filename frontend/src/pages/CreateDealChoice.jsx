import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Upload, Sparkles, PenLine } from "lucide-react";

const CreateDealChoice = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/deals")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Deals
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Deal</h1>
        <p className="text-gray-600">
          Choose how you'd like to add your deal information
        </p>
      </div>

      {/* Choice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        {/* Manual Entry Card */}
        <div
          onClick={() => navigate("/deals/new")}
          className="bg-white rounded-xl border-2 border-gray-200 p-8 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all duration-200 group"
        >
          <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-xl mb-6 group-hover:bg-blue-200 transition-colors">
            <PenLine className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Manual Entry</h2>
          <p className="text-gray-600 mb-4">
            Fill out the deal form manually. Best when you have all the information ready
            or want full control over each field.
          </p>
          <ul className="text-sm text-gray-500 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Step-by-step form
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Full control over all fields
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Add multiple facilities
            </li>
          </ul>
          <div className="mt-6 text-blue-600 font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
            Start Manual Entry
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </div>
        </div>

        {/* AI Upload Card */}
        <div
          onClick={() => navigate("/deals/upload-deal")}
          className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200 p-8 cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all duration-200 group relative overflow-hidden"
        >
          {/* AI Badge */}
          <div className="absolute top-4 right-4 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI Powered
          </div>

          <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-xl mb-6 group-hover:bg-purple-200 transition-colors">
            <Upload className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Upload Document</h2>
          <p className="text-gray-600 mb-4">
            Upload a CIM, broker package, or financial document and let AI extract
            all the deal information automatically.
          </p>
          <ul className="text-sm text-gray-500 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              PDF, Excel, Images supported
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              AI extracts 30+ fields
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              Review before saving
            </li>
          </ul>
          <div className="mt-6 text-purple-600 font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
            Upload Document
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </div>
        </div>
      </div>

      {/* Supported File Types */}
      <div className="mt-8 max-w-4xl">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Supported Document Types for AI Upload
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            "PDF Documents",
            "CIMs",
            "Broker Packages",
            "Financial Statements",
            "Excel Spreadsheets",
            "Images / Scans",
          ].map((type) => (
            <span
              key={type}
              className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-600"
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreateDealChoice;
