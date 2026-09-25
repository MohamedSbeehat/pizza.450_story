import { lazy, Suspense } from 'react';
import { StoryProvider } from '../../story/StoryProvider';
import { SceneContext } from '../../story/context';
import { story, useStory } from '../../story/store';
import { SafeBoundary } from '../RestaurantScene/SafeBoundary';
import { TIMELINE } from '../../data/story';
import { QUALITY } from '../../config/quality';

import { Hero } from '../Hero/Hero';
import { SunriseScene } from '../Scenes/SunriseScene/SunriseScene';
import { PeopleScene } from '../Scenes/PeopleScene/PeopleScene';
import { PlaceScene } from '../Scenes/PlaceScene/PlaceScene';
import { BuildScene } from '../Scenes/BuildScene/BuildScene';
import { PizzaScene } from '../Scenes/PizzaScene/PizzaScene';
import { FirstTableScene } from '../Scenes/FirstTableScene/FirstTableScene';
import { GrowthScene } from '../Scenes/GrowthScene/GrowthScene';
import { RevealScene } from '../Scenes/RevealScene/RevealScene';
import { FinaleScene } from '../Scenes/FinaleScene/FinaleScene';
import { Hud } from '../Navigation/Hud';
import { Letterbox } from '../Effects/Letterbox';
import { FilmGrain } from '../Effects/FilmGrain';
import { Transcript } from './Transcript';
import './Story.css';

// The 3D world (three.js + react-three-fiber) is a separate chunk, loaded
// only once the viewer is watching the story (see `worldArmed` in StoryProvider).
const World = lazy(() => import('../RestaurantScene/World'));

/** Scene id (from TIMELINE in data/story.js) → component. */
const SCENES = {
  hero: Hero,
  sunrise: SunriseScene,
  people: PeopleScene,
  place: PlaceScene,
  build: BuildScene,
  pizza: PizzaScene,
  firstTable: FirstTableScene,
  growth: GrowthScene,
  reveal: RevealScene,
  finale: FinaleScene,
};

function WorldLayer() {
  const armed = useStory((s) => s.worldArmed);
  const visible = useStory((s) => s.worldVisible);
  const failed = useStory((s) => s.worldFailed);
  if (!QUALITY.webgl || failed) return null;
  return (
    <div className={`world-layer${visible ? ' is-visible' : ''}`} aria-hidden="true">
      {armed ? (
        <SafeBoundary name="3D world" onError={() => story.set({ worldFailed: true })}>
          <Suspense fallback={null}>
            <World />
          </Suspense>
        </SafeBoundary>
      ) : null}
    </div>
  );
}

export function Story() {
  return (
    <StoryProvider>
      <main className="stage" aria-label="قصة بيتزرية 450">
        <WorldLayer />
        {TIMELINE.map((entry, index) => {
          const Scene = SCENES[entry.id];
          return (
            <SceneContext.Provider key={entry.id} value={{ index, id: entry.id }}>
              <Scene />
            </SceneContext.Provider>
          );
        })}
      </main>
      <Letterbox />
      <div className="vignette" aria-hidden="true" />
      <FilmGrain />
      <Hud />
      <Transcript />
    </StoryProvider>
  );
}
