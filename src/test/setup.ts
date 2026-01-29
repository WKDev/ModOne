/**
 * Vitest Setup File
 *
 * Configures the testing environment for React component tests.
 */

import '@testing-library/jest-dom';
import { enableMapSet } from 'immer';

// Enable immer MapSet plugin for tests using Zustand stores with Maps/Sets
enableMapSet();
