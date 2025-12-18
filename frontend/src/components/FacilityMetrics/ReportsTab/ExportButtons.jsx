import React, { useState } from 'react';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
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
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

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

      // Overview Section
      if (selectedSections.includes('overview')) {
        addSectionHeader('Facility Overview');
        doc.text(`Name: ${facility.provider_name || facility.facility_name}`, 14, yPos); yPos += 6;
        doc.text(`Location: ${facility.city}, ${facility.state} ${facility.zip}`, 14, yPos); yPos += 6;
        doc.text(`CCN: ${facility.ccn}`, 14, yPos); yPos += 6;
        doc.text(`Certified Beds: ${facility.certified_beds || 'N/A'}`, 14, yPos); yPos += 6;
        doc.text(`Ownership: ${facility.ownership_type || 'N/A'}`, 14, yPos); yPos += 12;
      }

      // Star Ratings Section
      if (selectedSections.includes('ratings')) {
        addSectionHeader('Star Ratings Summary');
        doc.autoTable({
          startY: yPos,
          head: [['Rating', 'Facility', 'National Avg']],
          body: [
            ['Overall Rating', facility.overall_rating || 'N/A', getBenchmark(benchmarks, 'national', 'overall_rating')?.toFixed(1) || '3.0'],
            ['Quality Rating', facility.quality_rating || 'N/A', getBenchmark(benchmarks, 'national', 'quality_rating')?.toFixed(1) || '3.0'],
            ['Staffing Rating', facility.staffing_rating || 'N/A', getBenchmark(benchmarks, 'national', 'staffing_rating')?.toFixed(1) || '3.0'],
            ['Inspection Rating', facility.health_inspection_rating || 'N/A', getBenchmark(benchmarks, 'national', 'health_inspection_rating')?.toFixed(1) || '3.0'],
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
        doc.autoTable({
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

      // Benchmark Comparison Section
      if (selectedSections.includes('benchmarks')) {
        addSectionHeader('Benchmark Comparison');
        doc.autoTable({
          startY: yPos,
          head: [['Metric', 'Facility', 'Market', 'State', 'National']],
          body: [
            ['Overall Rating', facility.overall_rating || 'N/A', getBenchmark(benchmarks, 'market', 'overall_rating')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'state', 'overall_rating')?.toFixed(1) || 'N/A', getBenchmark(benchmarks, 'national', 'overall_rating')?.toFixed(1) || 'N/A'],
            ['Staffing HPRD', facility.total_nursing_hprd?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'market', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'state', 'total_nursing_hprd')?.toFixed(2) || 'N/A', getBenchmark(benchmarks, 'national', 'total_nursing_hprd')?.toFixed(2) || 'N/A'],
            ['Occupancy', facility.occupancy_rate ? `${Math.round(facility.occupancy_rate)}%` : 'N/A', getBenchmark(benchmarks, 'market', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'market', 'occupancy'))}%` : 'N/A', getBenchmark(benchmarks, 'state', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'state', 'occupancy'))}%` : 'N/A', getBenchmark(benchmarks, 'national', 'occupancy') ? `${Math.round(getBenchmark(benchmarks, 'national', 'occupancy'))}%` : 'N/A'],
          ],
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }

      // Risk Assessment Section
      if (selectedSections.includes('risk')) {
        addSectionHeader('Risk Assessment');
        const regulatoryRisk = calculateRegulatoryRisk(facility);
        const staffingRisk = calculateStaffingRisk(facility);
        const financialRisk = calculateFinancialRisk(facility);
        const compositeScore = Math.round(regulatoryRisk * 0.40 + staffingRisk * 0.35 + financialRisk * 0.25);

        doc.text(`Composite Risk Score: ${compositeScore} (${getRiskLabel(compositeScore)})`, 14, yPos); yPos += 6;
        doc.text(`Regulatory Risk: ${regulatoryRisk} - ${getRiskLabel(regulatoryRisk)}`, 14, yPos); yPos += 6;
        doc.text(`Staffing Risk: ${staffingRisk} - ${getRiskLabel(staffingRisk)}`, 14, yPos); yPos += 6;
        doc.text(`Financial Risk: ${financialRisk} - ${getRiskLabel(financialRisk)}`, 14, yPos); yPos += 12;
      }

      // Trends Section
      if (selectedSections.includes('trends')) {
        addSectionHeader('Trends Summary');
        const snapshots = facility.snapshots || [];
        doc.autoTable({
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
        doc.autoTable({
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
        doc.autoTable({
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
      const XLSX = await import('xlsx');
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
