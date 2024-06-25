import { render, screen } from '@testing-library/react';
import App from './App';

test('renders assistant message', () => {
  render(<App />);
  const assistantMessage = screen.getByText(/You are a helpful assistant/i);
  expect(assistantMessage).toBeInTheDocument();
});
