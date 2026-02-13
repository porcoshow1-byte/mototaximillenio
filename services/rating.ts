import { supabase, isMockMode } from './supabase';
import { Review } from '../types';

export const TABLE_NAME = 'reviews';

// Mock Data Generator
const generateMockReviews = (driverId: string): Review[] => {
    const comments = [
        "Motorista muito educado e rápido!",
        "A moto estava limpa e a corrida foi tranquila.",
        "Chegou antes do horário. Recomendo!",
        "Excelente profissional.",
        "Um pouco rápido demais, mas chegou bem.",
        "Muito simpático, ótima conversa.",
        "Nota 10!",
        "O capacete extra estava limpinho.",
    ];

    return Array.from({ length: 8 }).map((_, i) => ({
        id: `rev_${i}`,
        rideId: `ride_${i}`,
        reviewerId: `user_${i}`,
        reviewerName: `Passageiro ${i + 1}`,
        reviewedId: driverId,
        rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 mostly
        comment: comments[i % comments.length],
        createdAt: Date.now() - Math.floor(Math.random() * 1000000000)
    })).sort((a, b) => b.createdAt - a.createdAt);
};

export const getDriverReviews = async (driverId: string): Promise<Review[]> => {
    if (isMockMode || !supabase) {
        // Return mock data
        return new Promise(resolve => setTimeout(() => resolve(generateMockReviews(driverId)), 800));
    }

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('reviewed_id', driverId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reviews:', error);
        return [];
    }

    return data.map((r: any) => ({
        id: r.id,
        rideId: r.ride_id,
        reviewerId: r.reviewer_id,
        reviewerName: r.reviewer_name || 'Passageiro', // Fallback if not joined
        reviewedId: r.reviewed_id,
        rating: r.rating,
        comment: r.comment,
        createdAt: new Date(r.created_at).getTime()
    }));
};
