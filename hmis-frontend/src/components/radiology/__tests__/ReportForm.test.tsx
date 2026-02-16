/**
 * Tests for ReportForm component
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RadStudy, RadReport, RadTemplate } from '@/types/radiology';

// Mock useEditor function
const mockUseEditor = jest.fn();

// Mock TipTap editor dependencies (optional dependencies - not installed)
jest.mock('@tiptap/react', () => ({
  useEditor: (config: any) => mockUseEditor(config),
  EditorContent: ({ editor }: any) => {
    // Render a simple div for testing
    return <div data-testid="editor-content">{editor?.getHTML()}</div>;
  },
}), { virtual: true });

jest.mock('@tiptap/starter-kit', () => ({
  __esModule: true,
  default: jest.fn(),
}), { virtual: true });

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Import component and toast after mocks
import { ReportForm, ReportFormProps } from '../ReportForm';
import { toast } from 'sonner';

// ─── Test Data ─────────────────────────────────────────────

const mockStudy: RadStudy = {
  id: 'study-123',
  order_id: 'order-123',
  accession_number: 'ACC-001',
  study_uid: '1.2.840.113619.2.1.1',
  modality: 'CT',
  study_description: 'CT Chest with contrast',
  patient_id: 'patient-123',
  patient_name: 'Juan Perez',
  patient_mrn: 'MRN-001',
  scheduled_date: '2026-02-16',
  performed_date: '2026-02-16T14:00:00Z',
  series_count: 3,
  images_count: 150,
  status: 'completed',
  created_at: '2026-02-16T14:00:00Z',
  updated_at: '2026-02-16T14:00:00Z',
};

const mockReport: RadReport = {
  id: 'report-123',
  study_id: 'study-123',
  report_number: 'REP-001',
  radiologist_id: 'rad-123',
  radiologist_name: 'Dr. Johnson',
  template_id: 'template-123',
  findings: '<p>Normal chest CT scan</p>',
  impression: '<p>No acute findings</p>',
  recommendations: 'Follow-up in 6 months',
  comparison_text: 'Compared to previous study',
  status: 'draft',
  created_at: '2026-02-16T15:00:00Z',
  updated_at: '2026-02-16T15:00:00Z',
};

const mockTemplates: RadTemplate[] = [
  {
    id: 'template-123',
    name: 'CT Chest Template',
    modality: 'CT',
    body_part: 'chest',
    template_text: 'FINDINGS:\nNormal chest CT\n\nIMPRESSION:\nNo acute findings',
    is_active: true,
    created_by_id: 'user-123',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'template-456',
    name: 'CT Abdomen Template',
    modality: 'CT',
    body_part: 'abdomen',
    template_text: 'FINDINGS:\nNormal abdomen CT\n\nIMPRESSION:\nNo abnormalities',
    is_active: true,
    created_by_id: 'user-123',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'template-789',
    name: 'MR Brain Template',
    modality: 'MR',
    body_part: 'brain',
    template_text: 'FINDINGS:\nNormal brain MR\n\nIMPRESSION:\nNo abnormalities',
    is_active: true,
    created_by_id: 'user-123',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
  },
];

const mockComparisonStudies: RadStudy[] = [
  {
    id: 'study-456',
    order_id: 'order-456',
    accession_number: 'ACC-002',
    study_uid: '1.2.840.113619.2.1.2',
    modality: 'CT',
    study_description: 'CT Chest',
    patient_id: 'patient-123',
    patient_name: 'Juan Perez',
    patient_mrn: 'MRN-001',
    performed_date: '2025-08-16T14:00:00Z',
    series_count: 3,
    images_count: 145,
    status: 'completed',
    created_at: '2025-08-16T14:00:00Z',
    updated_at: '2025-08-16T14:00:00Z',
  },
];

// ─── Helper Functions ──────────────────────────────────────

function renderReportForm(props?: Partial<ReportFormProps>) {
  const defaultProps: ReportFormProps = {
    study: mockStudy,
    templates: mockTemplates,
    onSubmit: jest.fn(),
    onSaveDraft: jest.fn(),
    ...props,
  };

  return render(<ReportForm {...defaultProps} />);
}

// ─── Component Rendering Tests ─────────────────────────────

describe('ReportForm - Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useEditor mock to return mock editors with state
    mockUseEditor.mockImplementation((config) => {
      let content = (config?.content as string) || '';
      return {
        getHTML: jest.fn(() => content),
        commands: {
          setContent: jest.fn((newContent) => {
            content = newContent;
          }),
        },
        // @ts-ignore
        isDestroyed: false,
      };
    });
  });

  it('renders report form with study information', () => {
    renderReportForm();

    expect(screen.getByText('Radiology Report')).toBeInTheDocument();
    expect(screen.getByText(/Juan Perez/)).toBeInTheDocument();
    expect(screen.getByText(/MRN-001/)).toBeInTheDocument();
    expect(screen.getByText(/CT Chest with contrast/)).toBeInTheDocument();
  });

  it('displays study details correctly', () => {
    renderReportForm();

    expect(screen.getByText(/Patient:/)).toBeInTheDocument();
    expect(screen.getByText(/Study:/)).toBeInTheDocument();
    expect(screen.getByText(/Date:/)).toBeInTheDocument();
  });

  it('renders template selector', () => {
    renderReportForm();

    const templateSelect = screen.getByRole('combobox');
    expect(templateSelect).toBeInTheDocument();
  });

  it('renders findings and impression editors', () => {
    renderReportForm();

    expect(screen.getByText(/Findings/i)).toBeInTheDocument();
    expect(screen.getByText(/Impression \/ Conclusion/i)).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    renderReportForm();

    expect(screen.getByRole('button', { name: /Save Draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign & Finalize/i })).toBeInTheDocument();
  });

  it('renders preview button when onPreview is provided', () => {
    const onPreview = jest.fn();
    renderReportForm({ onPreview });

    expect(screen.getByRole('button', { name: /Preview PDF/i })).toBeInTheDocument();
  });

  it('does not render preview button when onPreview is not provided', () => {
    renderReportForm({ onPreview: undefined });

    expect(screen.queryByRole('button', { name: /Preview PDF/i })).not.toBeInTheDocument();
  });

  it('renders comparison studies when provided', () => {
    renderReportForm({ comparisonStudies: mockComparisonStudies });

    expect(screen.getByText(/Comparison Studies/i)).toBeInTheDocument();
    expect(screen.getByText(/CT Chest - 2025-08-16/)).toBeInTheDocument();
  });

  it('does not render comparison studies section when empty', () => {
    renderReportForm({ comparisonStudies: [] });

    expect(screen.queryByText(/Comparison Studies/i)).not.toBeInTheDocument();
  });

  it('pre-fills form when report is provided', () => {
    renderReportForm({ report: mockReport });

    // Template should be pre-selected
    const templateSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(templateSelect.value).toBe('template-123');

    // Recommendations should be filled
    const recommendationsInput = screen.getByPlaceholderText(/Follow-up recommendations/i) as HTMLTextAreaElement;
    expect(recommendationsInput.value).toBe('Follow-up in 6 months');
  });
});

// ─── Template Selection Tests ──────────────────────────────

describe('ReportForm - Template Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useEditor mock to return mock editors with state
    mockUseEditor.mockImplementation((config) => {
      let content = (config?.content as string) || '';
      return {
        getHTML: jest.fn(() => content),
        commands: {
          setContent: jest.fn((newContent) => {
            content = newContent;
          }),
        },
        // @ts-ignore
        isDestroyed: false,
      };
    });
  });

  it('filters templates by modality', () => {
    renderReportForm();

    const templateSelect = screen.getByRole('combobox');
    const options = Array.from(templateSelect.querySelectorAll('option'));

    // Should show only CT templates (2) + placeholder option
    const ctTemplates = options.filter(opt => opt.textContent?.includes('CT'));
    expect(ctTemplates.length).toBe(2);

    // Should not show MR template
    expect(options.find(opt => opt.textContent?.includes('MR Brain'))).toBeUndefined();
  });

  it('allows selecting a template', async () => {
    const user = userEvent.setup();
    renderReportForm();

    const templateSelect = screen.getByRole('combobox');
    await user.selectOptions(templateSelect, 'template-123');

    expect((templateSelect as HTMLSelectElement).value).toBe('template-123');
  });

  it('applies template when Apply button is clicked', async () => {
    const user = userEvent.setup();

    const mockFindingsEditor = {
      getHTML: jest.fn(() => ''),
      commands: {
        setContent: jest.fn(),
      },
    };

    const mockImpressionEditor = {
      getHTML: jest.fn(() => ''),
      commands: {
        setContent: jest.fn(),
      },
    };

    // Mock useEditor to return our controlled editors
    mockUseEditor
      .mockReturnValueOnce(mockFindingsEditor as any)
      .mockReturnValueOnce(mockImpressionEditor as any);

    renderReportForm();

    // Select template
    const templateSelect = screen.getByRole('combobox');
    await user.selectOptions(templateSelect, 'template-123');

    // Click Apply button
    const applyButton = screen.getByRole('button', { name: /Apply/i });
    await user.click(applyButton);

    // Should set content in both editors
    expect(mockFindingsEditor.commands.setContent).toHaveBeenCalled();
    expect(mockImpressionEditor.commands.setContent).toHaveBeenCalled();

    // Should show success toast
    expect(toast.success).toHaveBeenCalledWith('Template applied');
  });

  it('disables Apply button when no template is selected', () => {
    renderReportForm();

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    expect(applyButton).toBeDisabled();
  });

  it('shows error when applying non-existent template', async () => {
    const user = userEvent.setup();

    const mockFindingsEditor = {
      getHTML: jest.fn(() => ''),
      commands: {
        setContent: jest.fn(),
      },
    };

    const mockImpressionEditor = {
      getHTML: jest.fn(() => ''),
      commands: {
        setContent: jest.fn(),
      },
    };

    mockUseEditor
      .mockReturnValueOnce(mockFindingsEditor as any)
      .mockReturnValueOnce(mockImpressionEditor as any);

    renderReportForm();

    // Manually set an invalid template ID (simulating race condition)
    const templateSelect = screen.getByRole('combobox');
    fireEvent.change(templateSelect, { target: { value: 'invalid-id' } });

    const applyButton = screen.getByRole('button', { name: /Apply/i });
    await user.click(applyButton);

    expect(toast.error).toHaveBeenCalledWith('Template not found');
  });
});

// ─── Form Submission Tests ─────────────────────────────────

describe('ReportForm - Form Submission', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useEditor mock to return mock editors with state
    mockUseEditor.mockImplementation((config) => {
      let content = (config?.content as string) || '';
      return {
        getHTML: jest.fn(() => content),
        commands: {
          setContent: jest.fn((newContent) => {
            content = newContent;
          }),
        },
        // @ts-ignore
        isDestroyed: false,
      };
    });
  });

  it('calls onSubmit with correct data when form is submitted', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const testReport = {
      ...mockReport,
      findings: '<p>Test findings</p>',
      impression: '<p>Test impression</p>',
    };

    renderReportForm({ onSubmit, report: testReport });

    const submitButton = screen.getByRole('button', { name: /Sign & Finalize/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          findings: '<p>Test findings</p>',
          impression: '<p>Test impression</p>',
        })
      );
    });
  });

  it('includes recommendations in submission data', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const mockFindingsEditor = {
      getHTML: jest.fn(() => '<p>Test findings</p>'),
      commands: { setContent: jest.fn() },
    };

    const mockImpressionEditor = {
      getHTML: jest.fn(() => '<p>Test impression</p>'),
      commands: { setContent: jest.fn() },
    };

    mockUseEditor
      .mockReturnValueOnce(mockFindingsEditor as any)
      .mockReturnValueOnce(mockImpressionEditor as any);

    renderReportForm({ onSubmit });

    // Fill recommendations
    const recommendationsInput = screen.getByPlaceholderText(/Follow-up recommendations/i);
    await user.type(recommendationsInput, 'Follow up in 3 months');

    const submitButton = screen.getByRole('button', { name: /Sign & Finalize/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recommendations: 'Follow up in 3 months',
        })
      );
    });
  });

  it('disables submit button while submitting', async () => {
    const onSubmit = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    const user = userEvent.setup();

    const mockFindingsEditor = {
      getHTML: jest.fn(() => '<p>Test findings</p>'),
      commands: { setContent: jest.fn() },
    };

    const mockImpressionEditor = {
      getHTML: jest.fn(() => '<p>Test impression</p>'),
      commands: { setContent: jest.fn() },
    };

    mockUseEditor
      .mockReturnValueOnce(mockFindingsEditor as any)
      .mockReturnValueOnce(mockImpressionEditor as any);

    renderReportForm({ onSubmit, isSubmitting: true });

    const submitButton = screen.getByRole('button', { name: /Signing.../i });
    expect(submitButton).toBeDisabled();
  });

  it('shows loading state when submitting', () => {
    renderReportForm({ isSubmitting: true });

    expect(screen.getByText(/Signing.../i)).toBeInTheDocument();
  });
});

// ─── Save Draft Tests ──────────────────────────────────────

describe('ReportForm - Save Draft', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useEditor mock to return mock editors with state
    mockUseEditor.mockImplementation((config) => {
      let content = (config?.content as string) || '';
      return {
        getHTML: jest.fn(() => content),
        commands: {
          setContent: jest.fn((newContent) => {
            content = newContent;
          }),
        },
        // @ts-ignore
        isDestroyed: false,
      };
    });
  });

  it('calls onSaveDraft when Save Draft button is clicked', async () => {
    const onSaveDraft = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const draftReport = {
      ...mockReport,
      findings: '<p>Draft findings</p>',
      impression: '<p>Draft impression</p>',
    };

    renderReportForm({ onSaveDraft, report: draftReport });

    const saveDraftButton = screen.getByRole('button', { name: /Save Draft/i });
    await user.click(saveDraftButton);

    await waitFor(() => {
      expect(onSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          findings: '<p>Draft findings</p>',
          impression: '<p>Draft impression</p>',
        })
      );
    });

    // Should show success toast
    expect(toast.success).toHaveBeenCalledWith('Draft saved');
  });

  it('disables Save Draft button while submitting', () => {
    renderReportForm({ isSubmitting: true });

    const saveDraftButton = screen.getByRole('button', { name: /Save Draft/i });
    expect(saveDraftButton).toBeDisabled();
  });

  it('shows last saved time after saving draft', async () => {
    const onSaveDraft = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const mockFindingsEditor = {
      getHTML: jest.fn(() => '<p>Draft findings</p>'),
      commands: { setContent: jest.fn() },
    };

    const mockImpressionEditor = {
      getHTML: jest.fn(() => '<p>Draft impression</p>'),
      commands: { setContent: jest.fn() },
    };

    mockUseEditor
      .mockReturnValueOnce(mockFindingsEditor as any)
      .mockReturnValueOnce(mockImpressionEditor as any);

    renderReportForm({ onSaveDraft });

    const saveDraftButton = screen.getByRole('button', { name: /Save Draft/i });
    await user.click(saveDraftButton);

    await waitFor(() => {
      expect(screen.getByText(/Last saved:/i)).toBeInTheDocument();
    });
  });
});

// ─── Preview Tests ─────────────────────────────────────────

describe('ReportForm - Preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useEditor mock to return mock editors with state
    mockUseEditor.mockImplementation((config) => {
      let content = (config?.content as string) || '';
      return {
        getHTML: jest.fn(() => content),
        commands: {
          setContent: jest.fn((newContent) => {
            content = newContent;
          }),
        },
        // @ts-ignore
        isDestroyed: false,
      };
    });
  });

  it('calls onPreview when Preview PDF button is clicked', async () => {
    const onPreview = jest.fn();
    const user = userEvent.setup();

    renderReportForm({ onPreview });

    const previewButton = screen.getByRole('button', { name: /Preview PDF/i });
    await user.click(previewButton);

    expect(onPreview).toHaveBeenCalled();
  });
});

// ─── Voice Dictation Tests ─────────────────────────────────

describe('ReportForm - Voice Dictation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseEditor.mockImplementation((config) => ({
      getHTML: jest.fn(() => (config?.content as string) || ''),
      commands: {
        setContent: jest.fn(),
      },
      // @ts-ignore
      isDestroyed: false,
    }));

    // Clean up window.webkitSpeechRecognition
    delete (window as any).webkitSpeechRecognition;
    delete (window as any).SpeechRecognition;
  });

  it('renders voice dictation button', () => {
    renderReportForm();

    expect(screen.getByRole('button', { name: /Voice Dictation/i })).toBeInTheDocument();
  });

  it('shows error when speech recognition is not supported', async () => {
    const user = userEvent.setup();

    renderReportForm();

    const dictationButton = screen.getByRole('button', { name: /Voice Dictation/i });
    await user.click(dictationButton);

    expect(toast.error).toHaveBeenCalledWith('Speech recognition not supported in this browser');
  });

  it('starts dictation when supported', async () => {
    const user = userEvent.setup();

    // Mock Speech Recognition API
    const mockRecognition = {
      continuous: false,
      interimResults: false,
      lang: '',
      start: jest.fn(),
      stop: jest.fn(),
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    };

    (window as any).webkitSpeechRecognition = jest.fn(() => mockRecognition);

    const mockFindingsEditor = {
      getHTML: jest.fn(() => ''),
      commands: {
        setContent: jest.fn(),
      },
    };

    const mockImpressionEditor = {
      getHTML: jest.fn(() => ''),
      commands: {
        setContent: jest.fn(),
      },
    };

    mockUseEditor
      .mockReturnValueOnce(mockFindingsEditor as any)
      .mockReturnValueOnce(mockImpressionEditor as any);

    renderReportForm();

    const dictationButton = screen.getByRole('button', { name: /Voice Dictation/i });
    await user.click(dictationButton);

    expect(mockRecognition.start).toHaveBeenCalled();
    expect(mockRecognition.continuous).toBe(true);
    expect(mockRecognition.interimResults).toBe(true);
  });
});

// ─── Comparison Studies Tests ──────────────────────────────

describe('ReportForm - Comparison Studies', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useEditor mock to return mock editors with state
    mockUseEditor.mockImplementation((config) => {
      let content = (config?.content as string) || '';
      return {
        getHTML: jest.fn(() => content),
        commands: {
          setContent: jest.fn((newContent) => {
            content = newContent;
          }),
        },
        // @ts-ignore
        isDestroyed: false,
      };
    });
  });

  it('allows selecting comparison studies', async () => {
    const user = userEvent.setup();

    renderReportForm({ comparisonStudies: mockComparisonStudies });

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('allows entering comparison text', async () => {
    const user = userEvent.setup();

    renderReportForm({ comparisonStudies: mockComparisonStudies });

    const comparisonText = screen.getByPlaceholderText(/Comparison notes/i);
    await user.type(comparisonText, 'Stable findings');

    expect((comparisonText as HTMLTextAreaElement).value).toBe('Stable findings');
  });
});
