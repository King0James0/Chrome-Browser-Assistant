import { useEffect, useState } from 'react';
import { builtInAvatars } from '../overlay/avatars';
import { getSettings, setSettings } from '../shared/storage';

export default function App() {
  const [avatarId, setAvatarId] = useState('astronaut');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>();
  const [defaultModel, setDefaultModel] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setAvatarId(s.avatarId);
      setAvatarDataUrl(s.avatarDataUrl);
      setDefaultModel(s.defaultModel);
    });
  }, []);

  async function handleSave() {
    await setSettings({ avatarId, avatarDataUrl, defaultModel });
    setSavedAt(Date.now());
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarDataUrl(reader.result as string);
      setAvatarId('custom');
    };
    reader.readAsDataURL(file);
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '2rem auto',
        padding: '0 1rem',
        color: '#222',
      }}
    >
      <h1 style={{ fontSize: 22 }}>Chrome-Browser-Assistant</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: 16 }}>Avatar</h2>
        <p style={{ color: '#666', fontSize: 13 }}>
          Pick a built-in character or upload your own (PNG, SVG, GIF, animated WebP).
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 8,
            marginTop: 12,
          }}
        >
          {builtInAvatars.map((a) => (
            <AvatarCard
              key={a.id}
              src={a.src}
              name={a.name}
              selected={avatarId === a.id}
              onClick={() => {
                setAvatarId(a.id);
              }}
            />
          ))}
          {avatarDataUrl && (
            <AvatarCard
              src={avatarDataUrl}
              name="Custom"
              selected={avatarId === 'custom'}
              onClick={() => setAvatarId('custom')}
            />
          )}
        </div>

        <label style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
          Upload custom:&nbsp;
          <input
            type="file"
            accept="image/png,image/svg+xml,image/gif,image/webp,image/jpeg"
            onChange={handleUpload}
          />
        </label>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: 16 }}>Default model</h2>
        <input
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          placeholder="model-id (registered in backend)"
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: 6,
            fontSize: 13,
            boxSizing: 'border-box',
          }}
        />
        <p style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
          Model registry / picker UI lands in a later task. For now, set the model id manually here.
        </p>
      </section>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSave}
          style={{
            background: '#3a7afe',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Save
        </button>
        {savedAt && Date.now() - savedAt < 2000 && (
          <span style={{ color: '#5a8a5e', fontSize: 13 }}>Saved.</span>
        )}
      </div>
    </main>
  );
}

interface AvatarCardProps {
  src: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}

function AvatarCard({ src, name, selected, onClick }: AvatarCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? '#dde9ff' : 'transparent',
        border: selected ? '2px solid #3a7afe' : '2px solid #ddd',
        borderRadius: 8,
        padding: 8,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <img
        src={src}
        alt={name}
        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
      />
      <div style={{ fontSize: 11, marginTop: 4 }}>{name}</div>
    </button>
  );
}
