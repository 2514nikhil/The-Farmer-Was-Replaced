'use client';

import { GameLayout } from '@/components/Layout';
import { GameCanvas } from '@/components/GameCanvas';
import { useGamePersistence } from '@/hooks/useGamePersistence';

export default function GamePage() {
  useGamePersistence();

  return (
    <GameLayout>
      <GameCanvas />
    </GameLayout>
  );
}
