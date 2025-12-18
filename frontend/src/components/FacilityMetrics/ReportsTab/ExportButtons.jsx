import React, { useState } from 'react';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  calculateRegulatoryRisk,
  calculateStaffingRisk,
  calculateFinancialRisk,
  getRiskLabel,
} from '../RiskAnalysisTab/CompositeRiskScore';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatCurrency = (value) => {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

// Helper to render star ratings as text (using simple characters for PDF compatibility)
const renderStars = (rating) => {
  if (rating == null || rating === 'N/A') return 'N/A';
  const numRating = parseInt(rating);
  if (isNaN(numRating)) return rating;
  const filled = Math.min(5, Math.max(0, numRating));
  const empty = 5 - filled;
  // Use asterisks for filled and dashes for empty (PDF font compatible)
  return '*'.repeat(filled) + '-'.repeat(empty) + ` (${numRating}/5)`;
};

// Helper to calculate VS National difference
const calcVsNational = (facilityValue, nationalValue, isPercentage = false, lowerIsBetter = false) => {
  if (facilityValue == null || nationalValue == null) return { diff: 'N/A', isNegative: false };
  const fVal = parseFloat(facilityValue);
  const nVal = parseFloat(nationalValue);
  if (isNaN(fVal) || isNaN(nVal)) return { diff: 'N/A', isNegative: false };
  const diff = fVal - nVal;
  const formatted = isPercentage ? `${diff >= 0 ? '+' : ''}${Math.round(diff)}%` : `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`;
  // For ratings/staffing/occupancy: higher is better. For deficiencies: lower is better
  const isNegative = lowerIsBetter ? diff > 0 : diff < 0;
  return { diff: formatted, isNegative };
};

// Get risk color for PDF [R, G, B]
const getRiskColor = (score) => {
  if (score >= 60) return [220, 38, 38]; // Red - High Risk
  if (score >= 40) return [245, 158, 11]; // Orange - Medium Risk
  return [34, 197, 94]; // Green - Low Risk
};

// Helper to get benchmark value - handles both avg_* and regular field names
const getBenchmark = (benchmarks, level, field) => {
  if (!benchmarks?.[level]) return null;
  const data = benchmarks[level];
  const fieldMap = {
    overall_rating: 'avg_overall_rating',
    quality_rating: 'avg_quality_rating',
    staffing_rating: 'avg_staffing_rating',
    health_inspection_rating: 'avg_inspection_rating',
    total_nursing_hprd: 'avg_total_nursing_hprd',
    rn_hprd: 'avg_rn_hprd',
    rn_turnover: 'avg_rn_turnover',
    occupancy: 'avg_occupancy',
    total_deficiencies: 'avg_deficiencies',
  };
  const backendField = fieldMap[field] || field;
  const value = data[backendField] ?? data[field];
  return value != null ? parseFloat(value) : null;
};

const ExportButtons = ({ facility, benchmarks, deficiencies, penalties, selectedSections }) => {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const generatePdfReport = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Helper function to add section header
      const addSectionHeader = (title) => {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      };

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Facility Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Overview Section - Enhanced layout like website
      if (selectedSections.includes('overview')) {
        addSectionHeader('Facility Overview');

        // Facility name as prominent header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(facility.provider_name || facility.facility_name || 'Unknown Facility', 14, yPos);
        yPos += 7;

        // Location and phone
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`${facility.city || ''}, ${facility.state || ''} ${facility.zip || ''}`.trim(), 14, yPos);
        yPos += 5;
        if (facility.phone) {
          doc.text(facility.phone, 14, yPos);
          yPos += 5;
        }
        doc.setTextColor(0, 0, 0);
        yPos += 3;

        // Details table
        autoTable(doc, {
          startY: yPos,
          body: [
            ['CCN:', facility.ccn || 'N/A'],
            ['Certified Beds:', facility.certified_beds || 'N/A'],
            ['Ownership:', facility.ownership_type || 'N/A'],
            ['Provider Type:', facility.provider_type || 'Medicare and Medicaid'],
          ],
          theme: 'plain',
          styles: { cellPadding: 2, fontSize: 10 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 40, textColor: [100, 100, 100] },
            1: { cellWidth: 'auto' },
          },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }

      // Star Ratings Section - With star symbols
      if (selectedSections.includes('ratings')) {
        addSectionHeader('Star Ratings Summary');
        autoTable(doc, {
          startY: yPos,
          head: [['Rating', 'Facility', 'National Avg']],
          body: [
            ['Overall Rating', renderStars(facility.overall_rating), getBenchmark(benchmarks, 'national', 'overall_rating')?.toFixed(1) || '3.0'],
            ['Quality Rating', renderStars(facility.quality_rating), getBenchmark(benchmarks, 'national', 'quality_rating')?.toFixed(1) || '3.0'],
            ['Staffing Rating', renderStars(facility.staffing_rating), getBenchmark(benchmarks, 'national', 'staffing_rating')?.toFixed(1) || '3.0'],
            ['Inspection Rating', renderStars(facility.health_inspection_rating), getBenchmark(benchmarks, 'national', 'health_inspection_rating')?.toFixed(1) || '3.0'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }

      // Key Metrics Section
      if (selectedSections.includes('metrics')) {
        addSectionHeader('Key Metrics');
        autoTable(doc, {
          startY: yPos,
          head: [['Metric', 'Facility', 'State Avg', 'National Avg']],
          body: [
            ['Total Nursing HPRD', facility.total_nursing_hprd?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'state', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'national', 'total_nursing_hprd')?.toFixed(2) || 'N/A'],
            ['RN HPRD', facility.rn_hprd?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'state', 'rn_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'national', 'rn_hprd')?.toFixed(2) || 'N/A'],
            ['RN Turnover', facility.rn_turnover_rate ? `${Math.round(facility.rn_turnover_rate)}%` : 'N/A', getBenchmark(benchmarks, 'state', 'rn_turnover') ? `${Math.round(getBenchmark(benchmarks, 'state', 'rn_turnover'))}%` : 'N/A', getBenchmark(benchmarks, 'national', 'rn_turnover') ? `${Math.round(getBenchmark(benchmarks, 'national', 'rn_turnover'))}%` : 'N/A'],
            ['Occupancy', facility.occupancy_rate ? `${Math.round(facility.occupancy_rate)}%` : 'N/A', getBenchmark(benchmarks, 'state', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'state', 'occupancy'))}%` : 'N/A', getBenchmark(benchmarks, 'national', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'national', 'occupancy'))}%` : 'N/A'],
            ['Total Deficiencies', facility.total_deficiencies || 0, getBenchmark(benchmarks, 'state', 'total_deficiencies')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'national', 'total_deficiencies')?.toFixed(1) || 'N/A'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }

      // Benchmark Comparison Section - With VS NATL column and color coding
      if (selectedSections.includes('benchmarks')) {
        addSectionHeader('Benchmark Comparison');

        // Calculate VS National differences
        const ratingVsNatl = calcVsNational(facility.overall_rating, getBenchmark(benchmarks, 'national', 'overall_rating'));
        const staffingVsNatl = calcVsNational(facility.total_nursing_hprd, getBenchmark(benchmarks, 'national', 'total_nursing_hprd'));
        const occupancyVsNatl = calcVsNational(facility.occupancy_rate, getBenchmark(benchmarks, 'national', 'occupancy'), true);

        // Store row data for color coding
        const benchmarkRows = [
          {
            data: ['Overall Rating', facility.overall_rating || 'N/A', getBenchmark(benchmarks, 'market', 'overall_rating')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'state', 'overall_rating')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'national', 'overall_rating')?.toFixed(1) || 'N/A', ratingVsNatl.diff],
            isNegative: ratingVsNatl.isNegative,
          },
          {
            data: ['Staffing HPRD', facility.total_nursing_hprd?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'market', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'state', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'national', 'total_nursing_hprd')?.toFixed(2) || 'N/A', staffingVsNatl.diff],
            isNegative: staffingVsNatl.isNegative,
          },
          {
            data: ['Occupancy', facility.occupancy_rate ? `${Math.round(facility.occupancy_rate)}%` : 'N/A', getBenchmark(benchmarks, 'market', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'market', 'occupancy'))}%` : 'N/A', getBenchmark(benchmarks, 'state', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'state', 'occupancy'))}%` : 'N/A', getBenchmark(benchmarks, 'national', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'national', 'occupancy'))}%` : 'N/A', occupancyVsNatl.diff],
            isNegative: occupancyVsNatl.isNegative,
          },
        ];

        autoTable(doc, {
          startY: yPos,
          head: [['Metric', 'Facility', 'Market', 'State', 'National', 'VS NATL']],
          body: benchmarkRows.map(r => r.data),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            // Color the VS NATL column based on whether it's negative
            if (data.section === 'body' && data.column.index === 5) {
              const rowInfo = benchmarkRows[data.row.index];
              if (rowInfo) {
                data.cell.styles.textColor = rowInfo.isNegative ? [220, 38, 38] : [34, 197, 94];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }

      // Risk Assessment Section - With visual composite score and colored risk levels
      if (selectedSections.includes('risk')) {
        addSectionHeader('Risk Assessment');
        const regulatoryRisk = calculateRegulatoryRisk(facility);
        const staffingRisk = calculateStaffingRisk(facility);
        const financialRisk = calculateFinancialRisk(facility);
        const compositeScore = Math.round(regulatoryRisk * 0.40 + staffingRisk * 0.35 + financialRisk * 0.25);
        const compositeColor = getRiskColor(compositeScore);

        // Draw composite score circle
        const circleX = 35;
        const circleY = yPos + 15;
        const circleRadius = 15;

        // Draw circle outline with risk color
        doc.setDrawColor(compositeColor[0], compositeColor[1], compositeColor[2]);
        doc.setLineWidth(2);
        doc.circle(circleX, circleY, circleRadius);

        // Draw score text in center
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(compositeColor[0], compositeColor[1], compositeColor[2]);
        doc.text(String(compositeScore), circleX, circleY + 1, { align: 'center' });

        // Draw risk label below
        doc.setFontSize(8);
        doc.text(getRiskLabel(compositeScore).toUpperCase(), circleX, circleY + circleRadius + 6, { align: 'center' });

        // Reset text color
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        // Risk breakdown table to the right of the circle
        const riskRows = [
          { category: 'Regulatory Risk', score: regulatoryRisk, label: getRiskLabel(regulatoryRisk), color: getRiskColor(regulatoryRisk) },
          { category: 'Staffing Risk', score: staffingRisk, label: getRiskLabel(staffingRisk), color: getRiskColor(staffingRisk) },
          { category: 'Financial Risk', score: financialRisk, label: getRiskLabel(financialRisk), color: getRiskColor(financialRisk) },
        ];

        autoTable(doc, {
          startY: yPos,
          body: riskRows.map(r => [r.category, `${r.score} - ${r.label}`]),
          theme: 'plain',
          styles: { cellPadding: 3, fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 50, halign: 'right' },
          },
          margin: { left: 60, right: 14 },
          didParseCell: (data) => {
            // Color the score/label column based on risk level
            if (data.section === 'body' && data.column.index === 1) {
              const rowInfo = riskRows[data.row.index];
              if (rowInfo) {
                data.cell.styles.textColor = rowInfo.color;
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });
        yPos = Math.max(circleY + circleRadius + 12, doc.lastAutoTable.finalY + 12);
      }

      // Trends Section
      if (selectedSections.includes('trends')) {
        addSectionHeader('Trends Summary');
        const snapshots = facility.snapshots || [];
        autoTable(doc, {
          startY: yPos,
          head: [['Metric', 'Current', '6mo Ago']],
          body: [
            ['Overall Rating', facility.overall_rating || 'N/A', snapshots[snapshots.length - 1]?.overall_rating || 'N/A'],
            ['Quality Rating', facility.quality_rating || 'N/A', snapshots[snapshots.length - 1]?.qm_rating || 'N/A'],
            ['Staffing Rating', facility.staffing_rating || 'N/A', snapshots[snapshots.length - 1]?.staffing_rating || 'N/A'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }

      // Deficiencies Section
      if (selectedSections.includes('deficiencies') && deficiencies?.length > 0) {
        addSectionHeader('Deficiency History');
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Tag', 'Scope/Severity']],
          body: deficiencies.slice(0, 10).map(d => [
            formatDate(d.survey_date),
            d.deficiency_tag || d.tag_number || 'N/A',
            d.scope_severity || 'N/A',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }

      // Penalties Section
      if (selectedSections.includes('penalties') && penalties?.length > 0) {
        addSectionHeader('Penalty History');
        const totalFines = facility.total_penalties_amount || penalties.reduce((sum, p) => sum + (parseFloat(p.fine_amount) || 0), 0);
        doc.text(`Total Fines: ${formatCurrency(totalFines)}`, 14, yPos); yPos += 8;
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Type', 'Amount']],
          body: penalties.slice(0, 10).map(p => [
            formatDate(p.penalty_date),
            p.penalty_type || 'Fine',
            formatCurrency(p.fine_amount || p.amount),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        });
      }

      // Save the PDF
      const filename = `${facility.provider_name || facility.facility_name}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename.replace(/[^a-z0-9_.-]/gi, '_'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const generateExcelReport = async () => {
    setExportingExcel(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Overview Sheet
      if (selectedSections.includes('overview')) {
        const overviewData = [
          ['Facility Overview'],
          [],
          ['Name', facility.provider_name || facility.facility_name],
          ['City', facility.city],
          ['State', facility.state],
          ['ZIP', facility.zip],
          ['CCN', facility.ccn],
          ['Certified Beds', facility.certified_beds || 'N/A'],
          ['Ownership', facility.ownership_type || 'N/A'],
          ['Phone', facility.phone || 'N/A'],
        ];
        const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
        XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');
      }

      // Ratings Sheet
      if (selectedSections.includes('ratings')) {
        const ratingsData = [
          ['Star Ratings Summary'],
          [],
          ['Rating', 'Facility', 'National Avg'],
          ['Overall Rating', facility.overall_rating || 'N/A', getBenchmark(benchmarks, 'national', 'overall_rating')?.toFixed(1) || '3.0'],
          ['Quality Rating', facility.quality_rating || 'N/A', getBenchmark(benchmarks, 'national', 'quality_rating')?.toFixed(1) || '3.0'],
          ['Staffing Rating', facility.staffing_rating || 'N/A', getBenchmark(benchmarks, 'national', 'staffing_rating')?.toFixed(1) || '3.0'],
          ['Inspection Rating', facility.health_inspection_rating || 'N/A', getBenchmark(benchmarks, 'national', 'health_inspection_rating')?.toFixed(1) || '3.0'],
        ];
        const ratingsSheet = XLSX.utils.aoa_to_sheet(ratingsData);
        XLSX.utils.book_append_sheet(workbook, ratingsSheet, 'Ratings');
      }

      // Metrics Sheet
      if (selectedSections.includes('metrics')) {
        const metricsData = [
          ['Key Metrics'],
          [],
          ['Metric', 'Facility', 'State Avg', 'National Avg'],
          ['Total Nursing HPRD', facility.total_nursing_hprd?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'state', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'national', 'total_nursing_hprd')?.toFixed(2) || 'N/A'],
          ['RN HPRD', facility.rn_hprd?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'state', 'rn_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'national', 'rn_hprd')?.toFixed(2) || 'N/A'],
          ['RN Turnover (%)', facility.rn_turnover_rate ? Math.round(facility.rn_turnover_rate) : 'N/A', getBenchmark(benchmarks, 'state', 'rn_turnover') ? Math.round(getBenchmark(benchmarks, 'state', 'rn_turnover')) : 'N/A', getBenchmark(benchmarks, 'national', 'rn_turnover') ? Math.round(getBenchmark(benchmarks, 'national', 'rn_turnover')) : 'N/A'],
          ['Occupancy (%)', facility.occupancy_rate ? Math.round(facility.occupancy_rate) : 'N/A', getBenchmark(benchmarks, 'state', 'occupancy') ? Math.round(getBenchmark(benchmarks, 'state', 'occupancy')) : 'N/A', getBenchmark(benchmarks, 'national', 'occupancy') ? Math.round(getBenchmark(benchmarks, 'national', 'occupancy')) : 'N/A'],
          ['Total Deficiencies', facility.total_deficiencies || 0, getBenchmark(benchmarks, 'state', 'total_deficiencies')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'national', 'total_deficiencies')?.toFixed(1) || 'N/A'],
        ];
        const metricsSheet = XLSX.utils.aoa_to_sheet(metricsData);
        XLSX.utils.book_append_sheet(workbook, metricsSheet, 'Metrics');
      }

      // Benchmarks Sheet
      if (selectedSections.includes('benchmarks')) {
        const benchmarksData = [
          ['Benchmark Comparison'],
          [],
          ['Metric', 'Facility', 'Market', 'State', 'National'],
          ['Overall Rating', facility.overall_rating || 'N/A', getBenchmark(benchmarks, 'market', 'overall_rating')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'state', 'overall_rating')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'national', 'overall_rating')?.toFixed(1) || 'N/A'],
          ['Staffing HPRD', facility.total_nursing_hprd?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'market', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'state', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'national', 'total_nursing_hprd')?.toFixed(2) || 'N/A'],
          ['Occupancy (%)', facility.occupancy_rate ? Math.round(facility.occupancy_rate) : 'N/A', getBenchmark(benchmarks, 'market', 'occupancy') ? Math.round(getBenchmark(benchmarks, 'market', 'occupancy')) : 'N/A', getBenchmark(benchmarks, 'state', 'occupancy') ? Math.round(getBenchmark(benchmarks, 'state', 'occupancy')) : 'N/A', getBenchmark(benchmarks, 'national', 'occupancy') ? Math.round(getBenchmark(benchmarks, 'national', 'occupancy')) : 'N/A'],
        ];
        const benchmarksSheet = XLSX.utils.aoa_to_sheet(benchmarksData);
        XLSX.utils.book_append_sheet(workbook, benchmarksSheet, 'Benchmarks');
      }

      // Risk Sheet
      if (selectedSections.includes('risk')) {
        const regulatoryRisk = calculateRegulatoryRisk(facility);
        const staffingRisk = calculateStaffingRisk(facility);
        const financialRisk = calculateFinancialRisk(facility);
        const compositeScore = Math.round(regulatoryRisk * 0.40 + staffingRisk * 0.35 + financialRisk * 0.25);

        const riskData = [
          ['Risk Assessment'],
          [],
          ['Composite Risk Score', compositeScore],
          ['Risk Level', getRiskLabel(compositeScore)],
          [],
          ['Risk Category', 'Score', 'Level'],
          ['Regulatory Risk', regulatoryRisk, getRiskLabel(regulatoryRisk)],
          ['Staffing Risk', staffingRisk, getRiskLabel(staffingRisk)],
          ['Financial Risk', financialRisk, getRiskLabel(financialRisk)],
        ];
        const riskSheet = XLSX.utils.aoa_to_sheet(riskData);
        XLSX.utils.book_append_sheet(workbook, riskSheet, 'Risk');
      }

      // Deficiencies Sheet
      if (selectedSections.includes('deficiencies') && deficiencies?.length > 0) {
        const defData = [
          ['Deficiency History'],
          [],
          ['Date', 'Tag', 'Scope/Severity', 'Description'],
          ...deficiencies.slice(0, 50).map(d => [
            formatDate(d.survey_date),
            d.deficiency_tag || d.tag_number || 'N/A',
            d.scope_severity || 'N/A',
            (d.deficiency_text || d.description)?.substring(0, 200) || 'N/A',
          ]),
        ];
        const defSheet = XLSX.utils.aoa_to_sheet(defData);
        XLSX.utils.book_append_sheet(workbook, defSheet, 'Deficiencies');
      }

      // Penalties Sheet
      if (selectedSections.includes('penalties') && penalties?.length > 0) {
        const totalFines = facility.total_penalties_amount || penalties.reduce((sum, p) => sum + (parseFloat(p.fine_amount) || 0), 0);
        const penData = [
          ['Penalty History'],
          [],
          ['Total Fines', totalFines],
          [],
          ['Date', 'Type', 'Amount'],
          ...penalties.slice(0, 50).map(p => [
            formatDate(p.penalty_date),
            p.penalty_type || 'Fine',
            p.fine_amount || p.amount || 0,
          ]),
        ];
        const penSheet = XLSX.utils.aoa_to_sheet(penData);
        XLSX.utils.book_append_sheet(workbook, penSheet, 'Penalties');
      }

      // Save the workbook
      const filename = `${facility.provider_name || facility.facility_name}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename.replace(/[^a-z0-9_.-]/gi, '_'));
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const isDisabled = selectedSections.length === 0;

  return (
    <div className="export-buttons">
      <button
        className="export-btn export-pdf"
        onClick={generatePdfReport}
        disabled={isDisabled || exportingPdf}
      >
        {exportingPdf ? (
          <>
            <Loader2 size={16} className="spinning" />
            Generating...
          </>
        ) : (
          <>
            <FileDown size={16} />
            Export PDF
          </>
        )}
      </button>

      <button
        className="export-btn export-excel"
        onClick={generateExcelReport}
        disabled={isDisabled || exportingExcel}
      >
        {exportingExcel ? (
          <>
            <Loader2 size={16} className="spinning" />
            Generating...
          </>
        ) : (
          <>
            <FileSpreadsheet size={16} />
            Export Excel
          </>
        )}
      </button>
    </div>
  );
};

export default ExportButtons;
