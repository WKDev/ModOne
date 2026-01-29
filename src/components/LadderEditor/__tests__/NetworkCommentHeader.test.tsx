/**
 * NetworkCommentHeader Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkCommentHeader } from '../NetworkCommentHeader';

describe('NetworkCommentHeader', () => {
  const mockOnUpdateComment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders placeholder when no comment', () => {
    render(
      <NetworkCommentHeader
        comment=""
        onUpdateComment={mockOnUpdateComment}
      />
    );

    expect(screen.getByText('Click to add a comment...')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(
      <NetworkCommentHeader
        comment=""
        onUpdateComment={mockOnUpdateComment}
        placeholder="Custom placeholder"
      />
    );

    expect(screen.getByText('Custom placeholder')).toBeInTheDocument();
  });

  it('renders comment text when comment exists', () => {
    render(
      <NetworkCommentHeader
        comment="This is a test comment"
        onUpdateComment={mockOnUpdateComment}
      />
    );

    expect(screen.getByText('This is a test comment')).toBeInTheDocument();
  });

  it('enters edit mode when clicked', () => {
    render(
      <NetworkCommentHeader
        comment="Original comment"
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Original comment'));

    expect(screen.getByRole('textbox')).toHaveValue('Original comment');
  });

  it('enters edit mode when clicking placeholder', () => {
    render(
      <NetworkCommentHeader
        comment=""
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Click to add a comment...'));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('saves comment on blur', async () => {
    render(
      <NetworkCommentHeader
        comment=""
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Click to add a comment...'));

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'New comment');
    fireEvent.blur(textarea);

    expect(mockOnUpdateComment).toHaveBeenCalledWith('New comment');
  });

  it('saves comment on Ctrl+Enter', async () => {
    render(
      <NetworkCommentHeader
        comment=""
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Click to add a comment...'));

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'New comment');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(mockOnUpdateComment).toHaveBeenCalledWith('New comment');
  });

  it('cancels edit on Escape', async () => {
    render(
      <NetworkCommentHeader
        comment="Original"
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Original'));

    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Changed');
    await userEvent.keyboard('{Escape}');

    // Should exit edit mode without saving
    expect(mockOnUpdateComment).not.toHaveBeenCalled();
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('does not enter edit mode when editable is false', () => {
    render(
      <NetworkCommentHeader
        comment="Read only comment"
        onUpdateComment={mockOnUpdateComment}
        editable={false}
      />
    );

    fireEvent.click(screen.getByText('Read only comment'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('trims whitespace from comment before saving', async () => {
    render(
      <NetworkCommentHeader
        comment=""
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Click to add a comment...'));

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, '  Trimmed comment  ');
    fireEvent.blur(textarea);

    expect(mockOnUpdateComment).toHaveBeenCalledWith('Trimmed comment');
  });

  it('does not call onUpdateComment if comment unchanged', async () => {
    render(
      <NetworkCommentHeader
        comment="Same comment"
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Same comment'));

    const textarea = screen.getByRole('textbox');
    fireEvent.blur(textarea);

    expect(mockOnUpdateComment).not.toHaveBeenCalled();
  });

  it('shows expand button for long comments', () => {
    const longComment = 'This is a very long comment that exceeds the 100 character limit and should trigger the expand button to appear in the UI for better readability.';

    render(
      <NetworkCommentHeader
        comment={longComment}
        onUpdateComment={mockOnUpdateComment}
      />
    );

    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('toggles expand/collapse for long comments', () => {
    const longComment = 'This is a very long comment that exceeds the 100 character limit and should trigger the expand button to appear in the UI for better readability.';

    render(
      <NetworkCommentHeader
        comment={longComment}
        onUpdateComment={mockOnUpdateComment}
      />
    );

    // Initially shows "Show more"
    expect(screen.getByText('Show more')).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText('Show more'));
    expect(screen.getByText('Show less')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('Show less'));
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('shows expand button for multi-line comments', () => {
    const multiLineComment = 'Line 1\nLine 2\nLine 3';

    render(
      <NetworkCommentHeader
        comment={multiLineComment}
        onUpdateComment={mockOnUpdateComment}
      />
    );

    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('preserves line breaks in comments', () => {
    const multiLineComment = 'First line\nSecond line';

    render(
      <NetworkCommentHeader
        comment={multiLineComment}
        onUpdateComment={mockOnUpdateComment}
      />
    );

    // The comment should be in the document (whitespace-pre-wrap preserves line breaks)
    expect(screen.getByText(/First line/)).toBeInTheDocument();
    expect(screen.getByText(/Second line/)).toBeInTheDocument();
  });

  it('shows keyboard shortcut hints in edit mode', () => {
    render(
      <NetworkCommentHeader
        comment=""
        onUpdateComment={mockOnUpdateComment}
      />
    );

    fireEvent.click(screen.getByText('Click to add a comment...'));

    expect(screen.getByText('Ctrl+Enter to save')).toBeInTheDocument();
    expect(screen.getByText('Escape to cancel')).toBeInTheDocument();
  });
});
