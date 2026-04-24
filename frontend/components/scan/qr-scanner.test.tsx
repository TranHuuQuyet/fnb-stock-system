import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QrScanner } from './qr-scanner';

const startMock = vi.fn();
const stopMock = vi.fn();
const clearMock = vi.fn();

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: startMock,
    stop: stopMock,
    clear: clearMock
  }))
}));

describe('QrScanner', () => {
  beforeEach(() => {
    startMock.mockReset();
    stopMock.mockReset();
    clearMock.mockReset();
    startMock.mockResolvedValue(undefined);
    stopMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('does not restart the scanner when the parent rerenders with a new callback', async () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const { rerender, unmount } = render(<QrScanner onDetected={firstHandler} />);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    rerender(<QrScanner onDetected={secondHandler} />);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });
    expect(stopMock).not.toHaveBeenCalled();

    unmount();

    await waitFor(() => {
      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces a friendly error when the camera cannot start', async () => {
    startMock.mockRejectedValueOnce(new Error('camera failed'));
    const onError = vi.fn();

    render(<QrScanner onDetected={vi.fn()} onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'Khong the khoi dong camera quet. Hay kiem tra quyen camera roi thu lai.'
      );
    });
  });
});
