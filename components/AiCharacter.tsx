// src/components/AiCharacter.tsx

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Box, Typography, Avatar, Grow, Stack } from '@mui/material';
import { Person, Forum } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiCharacterProps {
  isLoading: boolean;
  characterImageUrl: string;
  backgroundImageUrl: string;
  latestUserQuestion: string | null;
  speakingTranscript: string;
  isDemoMode: boolean;
  demoQuestions: string[];
  currentDemoQuestionIndex: number;
  avatarMode: 'did' | 'chrome';
  stream: MediaStream | null;
  isDidAgentConnected: boolean;
  telopFontFamily: string | null;
  telopFontSize: number;
}

/**
 * AIキャラクターの静止画とテロップを表示するコンポーネント。
 */
const AiCharacter: React.FC<AiCharacterProps> = ({ 
    isLoading, 
    characterImageUrl, 
    backgroundImageUrl, 
    latestUserQuestion, 
    speakingTranscript, 
    isDemoMode, 
    demoQuestions, 
    currentDemoQuestionIndex,
    avatarMode,
    stream,
    isDidAgentConnected,
    telopFontFamily,
    telopFontSize
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (avatarMode === 'did' && stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        // D-IDの音声はストリームに含まれるため、video要素のmutedは解除する
        videoRef.current.muted = false; 
    }
  }, [stream, avatarMode]);

  const telopBaseStyle = {
      position: 'absolute' as 'absolute',
      bgcolor: 'rgba(0, 0, 0, 0.6)',
      color: 'white',
      p: '8px 12px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      zIndex: 5,
      maxWidth: '45%',
      backdropFilter: 'blur(3px)',
      fontFamily: telopFontFamily || 'Inter, Roboto, sans-serif',
  };
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      backgroundColor: '#000',
      backgroundImage: `url(${backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
        {avatarMode === 'did' ? (
             <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 1,
                }}
            />
        ) : (
             <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                backdropFilter: 'blur(2px)',
            }}>
                <img
                    src={characterImageUrl}
                    alt="AI Character"
                    style={{
                        width: 'auto',
                        height: '90%',
                        maxHeight: '500px',
                        objectFit: 'contain',
                        opacity: isLoading ? 0.7 : 1,
                        filter: isLoading ? 'grayscale(50%)' : 'none',
                        transition: 'opacity 0.3s, filter 0.3s',
                    }}
                />
            </div>
        )}

      {/* ユーザーの質問テロップ (左上) */}
      {latestUserQuestion && (
        <Grow in={true} children={
            <Box sx={{ ...telopBaseStyle, top: '20px', left: '20px' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}><Person sx={{ fontSize: '1rem' }} /></Avatar>
                    <Typography variant="body2" sx={{ fontWeight: '500', fontSize: `${telopFontSize}px` }}>{latestUserQuestion}</Typography>
                </Stack>
            </Box>
        } />
      )}

      {/* 自動デモ中の質問一覧 (右上) */}
      {isDemoMode && demoQuestions.length > currentDemoQuestionIndex && (
        <Grow in={true} children={
            <Box sx={{ ...telopBaseStyle, top: '20px', right: '20px', maxWidth: '30%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 <Typography variant="body2" sx={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.7)', pb: 1, mb: 1, display: 'flex', alignItems: 'center' }}>
                    <Forum sx={{ mr: 1 }} />
                    今後の質問
                </Typography>
                <Stack spacing={1.5}>
                    {demoQuestions.slice(currentDemoQuestionIndex, currentDemoQuestionIndex + 4).map((question, index) => (
                        <React.Fragment key={index}>
                            <Grow in={true} timeout={(index + 1) * 300} children={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: index === 0 ? 1 : 0.6, pl: index === 0 ? 1 : 0, borderLeft: index === 0 ? '3px solid' : 'none', borderColor: 'primary.main' }}>
                                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', flexShrink: 0 }}><Person sx={{ fontSize: '1rem' }} /></Avatar>
                                    <Typography variant="caption">{question}</Typography>
                                </Box>
                            } />
                        </React.Fragment>
                    ))}
                </Stack>
            </Box>
        } />
      )}

      {/* AIの回答テロップ (左下) */}
      {speakingTranscript && (
        <Grow in={!!speakingTranscript} children={
            <Box sx={{ ...telopBaseStyle, bottom: '80px', left: '20px' }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar src={characterImageUrl} sx={{ width: 28, height: 28, mt: '2px', flexShrink: 0 }}/>
                    <Box 
                        className="markdown-content"
                        sx={{ 
                            fontWeight: '500',
                            lineHeight: 1.5,
                            fontSize: `${telopFontSize}px`,
                             // Markdownのスタイルを上書き
                            '& p': { margin: 0 },
                            '& ul, & ol': { m: 0, pl: 2.5 },
                            '& li': { mb: 0.5 }
                        }}
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{speakingTranscript}</ReactMarkdown>
                    </Box>
                </Stack>
            </Box>
        } />
      )}

    </div>
  );
};

export default AiCharacter;