
import { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Sphere } from '@react-three/drei'
import * as THREE from 'three'

interface VectorData {
  id: string
  document: string
  metadata: Record<string, any>
}

// 3D Vector Node Component
function VectorNode({ vector, position, onClick, isSelected }: {
  vector: VectorData
  position: [number, number, number]
  onClick: () => void
  isSelected: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  // Removed all spinning and floating animations - clean static positioning like Neo4j

  const getColor = () => {
    const language = vector.metadata.language || 'unknown'
    switch (language) {
      case 'typescript': return '#3178c6'
      case 'javascript': return '#f7df1e'
      case 'python': return '#3776ab'
      case 'java': return '#007396'
      case 'go': return '#00add8'
      default: return '#6b7280'
    }
  }

  return (
    <group position={position}>
      <Sphere
        ref={meshRef}
        args={[0.5, 32, 32]}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={getColor()}
          emissive={isSelected ? '#ffffff' : hovered ? '#444444' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : hovered ? 0.1 : 0}
        />
      </Sphere>
      
      {/* Document preview text */}
      <Text
        position={[0, -1, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={3}
      >
        {vector.document.substring(0, 50)}...
      </Text>

      {/* File name */}
      <Text
        position={[0, 1, 0]}
        fontSize={0.15}
        color="#cccccc"
        anchorX="center"
        anchorY="middle"
      >
        {vector.metadata.filePath?.split('/').pop() || 'Unknown'}
      </Text>
    </group>
  )
}

// 3D Scene Component
function VectorScene({ vectors, selectedVector, onVectorSelect }: {
  vectors: VectorData[]
  selectedVector: VectorData | null
  onVectorSelect: (vector: VectorData) => void
}) {
  const groupRef = useRef<THREE.Group>(null)

  // Removed group rotation - static positioning

  return (
    <group ref={groupRef}>
      {vectors.map((vector, index) => {
        const angle = (index / vectors.length) * Math.PI * 2
        const radius = 5 + (index % 3) * 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const y = (index % 5) * 1.5 - 3

        return (
          <VectorNode
            key={vector.id}
            vector={vector}
            position={[x, y, z]}
            onClick={() => onVectorSelect(vector)}
            isSelected={selectedVector?.id === vector.id}
          />
        )
      })}
    </group>
  )
}

// Clean Background - no distracting elements

function App() {
  const [vectors, setVectors] = useState<VectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVector, setSelectedVector] = useState<VectorData | null>(null)
  const [languageStats, setLanguageStats] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchVectors()
  }, [])

  const fetchVectors = async () => {
    try {
      const chromaUrl = import.meta.env.VITE_CHROMA_URL || 'http://localhost:8000'
      const authToken = import.meta.env.VITE_CHROMA_AUTH_TOKEN || 'test-token'
      
      const collectionsResponse = await fetch(`${chromaUrl}/api/v2/tenants/default_tenant/databases/default_database/collections`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!collectionsResponse.ok) {
        throw new Error(`Failed to get collections: ${collectionsResponse.status}`)
      }

      const collections = await collectionsResponse.json()
      const codeVectorsCollection = collections.find((col: any) => col.name === 'code_vectors')
      
      if (!codeVectorsCollection) {
        throw new Error('code_vectors collection not found')
      }

      const response = await fetch(`${chromaUrl}/api/v2/tenants/default_tenant/databases/default_database/collections/${codeVectorsCollection.id}/get`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          include: ['documents', 'metadatas'],
          limit: 50
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      const vectorData: VectorData[] = data.ids.map((id: string, index: number) => ({
        id,
        document: data.documents?.[index] || '',
        metadata: data.metadatas?.[index] || {}
      }))
      
      // Calculate language statistics from actual data
      const stats: Record<string, number> = {}
      vectorData.forEach((vector) => {
        const lang = vector.metadata.language || 'unknown'
        stats[lang] = (stats[lang] || 0) + 1
      })
      setLanguageStats(stats)
      
      setVectors(vectorData)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vectors')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">Loading 3D Vector Visualization...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">
          <h3>Connection Error</h3>
          <p>{error}</p>
          <p>Make sure ChromaDB is running on http://localhost:8000 with auth token "test-token"</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="header">
        <h1>🧬 ChromaDB v2 3D Visualization</h1>
        <p>Interactive 3D Vector Space - {vectors.length} vectors</p>
      </div>

      {selectedVector && (
        <div className="info-panel">
          <h3>Selected Vector</h3>
          <p><strong>File:</strong> {selectedVector.metadata.filePath?.split('/').pop()}</p>
          <p><strong>Language:</strong> {selectedVector.metadata.language || 'unknown'}</p>
          <p><strong>Type:</strong> {selectedVector.metadata.type || 'unknown'}</p>
          <p><strong>Content:</strong> {selectedVector.document.substring(0, 100)}...</p>
          <button onClick={() => setSelectedVector(null)}>Close</button>
        </div>
      )}

      {/* Dynamic Language Legend */}
      <div className="language-legend">
        <h4>Languages ({Object.keys(languageStats).length} detected)</h4>
        {Object.entries(languageStats)
          .sort(([,a], [,b]) => b - a)
          .map(([lang, count]) => {
            const getColor = () => {
              switch (lang) {
                case 'typescript': return '#3178c6'
                case 'javascript': return '#f7df1e'
                case 'python': return '#3776ab'
                case 'java': return '#007396'
                case 'go': return '#00add8'
                case 'rust': return '#dea584'
                case 'cpp': return '#00599c'
                case 'c': return '#a8b9cc'
                default: return '#6b7280'
              }
            }
            
            return (
              <div key={lang} className="legend-item">
                <div className="color-dot" style={{ backgroundColor: getColor() }}></div>
                <span>{lang} ({count})</span>
              </div>
            )
          })}
        {vectors.length === 0 && (
          <div className="legend-item">
            <span>No data available</span>
          </div>
        )}
      </div>

      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />
          
          <VectorScene
            vectors={vectors}
            selectedVector={selectedVector}
            onVectorSelect={setSelectedVector}
          />
          
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
      </div>

      <div className="controls-info">
        <p>🖱️ Click and drag to rotate • 🔍 Scroll to zoom • 📦 Click spheres for details</p>
      </div>
    </div>
  )
}

export default App
