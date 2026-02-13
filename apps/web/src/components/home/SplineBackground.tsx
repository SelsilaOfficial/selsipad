'use client';

import React from 'react';
import { AnimatedBackground } from './figma/AnimatedBackground';

/**
 * SplineBackground - Replaced with lightweight AnimatedBackground
 *
 * Previously loaded @splinetool/react-spline (~2.5MB runtime)
 * which caused 5-10 second page load delays across all pages.
 *
 * Now uses the CSS/Framer Motion AnimatedBackground instead,
 * which achieves a similar visual effect with near-zero bundle cost.
 */
export function SplineBackground() {
  return <AnimatedBackground />;
}
