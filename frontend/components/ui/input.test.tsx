import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it('forwards refs to the native input element', () => {
    const ref = React.createRef<HTMLInputElement>();

    render(<Input ref={ref} label="Username" />);

    expect(screen.getByLabelText('Username')).toBe(ref.current);
    expect(ref.current?.tagName).toBe('INPUT');
  });
});
