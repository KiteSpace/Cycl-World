import { Sky as DreiSky, Stars, Cloud } from '@react-three/drei'
import { useControls, folder } from 'leva'

export function Sky({ preset = 'sunset', showStars = false, showClouds = true }) {
  const presets = {
    sunset: { sunPosition: [1, 0.1, -1], turbidity: 8, rayleigh: 2 },
    noon: { sunPosition: [0, 1, 0], turbidity: 2, rayleigh: 0.5 },
    dawn: { sunPosition: [-1, 0.05, 0], turbidity: 10, rayleigh: 3 },
    dusk: { sunPosition: [1, 0.02, 0], turbidity: 10, rayleigh: 4 },
    night: { sunPosition: [0, -1, 0], turbidity: 0, rayleigh: 0 },
    cloudy: { sunPosition: [0, 0.5, 1], turbidity: 20, rayleigh: 0.1 },
  }

  const settings = presets[preset] || presets.sunset

  return (
    <group>
      <DreiSky
        distance={450000}
        sunPosition={settings.sunPosition}
        turbidity={settings.turbidity}
        rayleigh={settings.rayleigh}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {showStars && preset === 'night' && (
        <Stars
          radius={100}
          depth={50}
          count={5000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />
      )}

      {showClouds && preset !== 'night' && (
        <group>
          <Cloud position={[-20, 15, -30]} speed={0.2} opacity={0.5} />
          <Cloud position={[30, 12, -20]} speed={0.1} opacity={0.3} />
          <Cloud position={[0, 18, -40]} speed={0.15} opacity={0.4} />
        </group>
      )}
    </group>
  )
}

export function InteractiveSky() {
  const { preset, showStars, showClouds } = useControls('Sky', {
    preset: {
      value: 'sunset',
      options: ['sunset', 'noon', 'dawn', 'dusk', 'night', 'cloudy'],
    },
    showStars: true,
    showClouds: true,
  })

  return <Sky preset={preset} showStars={showStars} showClouds={showClouds} />
}

export default Sky
