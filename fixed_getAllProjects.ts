// Fixed getAllProjects implementation - paste this into projects.ts

export async function getAllProjects(filters?: {
  status?: Project['status'];
  network?: Project['network'];
  type?: Project['type'];
  search?: string;
}): Promise<Project[]> {
  const supabase = createClient();

  try {
    // Query projects with launch_rounds joined
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        launch_rounds (
          id,
          type,
          status,
          chain,
          start_at,
          end_at,
          params
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }

    // Map each project with its launch_round data
    let projects = (data || []).flatMap((project: any) => {
      // If project has no launch_rounds, skip it
      if (!project.launch_rounds || project.launch_rounds.length === 0) {
        return [];
      }

      // Map each launch_round to a project entry
      return project.launch_rounds.map((round: any) => {
        const params = round.params || {};
        
        return {
          id: project.id,
          name: params.project_name || project.name,
          symbol: params.token_symbol || project.symbol || 'TBD',
          logo: params.logo_url || project.logo_url || '/placeholder-logo.png',
          description: params.project_description || project.description || '',
          type: round.type?.toLowerCase() as 'presale' | 'fairlaunch',
          network: mapChainToNetwork(round.chain),
          status: mapLaunchRoundStatus(round.status),
          raised: params.total_raised || 0,
          target: params.softcap || params.hardcap || 1000,
          kyc_verified: !!project.kyc_submission_id,
          audit_status: project.scan_result_id ? 'pass' : null,
          lp_lock: params.lp_lock || false,
        };
      });
    });

    // Client-side filtering
    if (filters?.network) {
      projects = projects.filter((p) => p.network === filters.network);
    }
    if (filters?.type) {
      projects = projects.filter((p) => p.type === filters.type);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      projects = projects.filter(
        (p) => p.name.toLowerCase().includes(search) || p.symbol.toLowerCase().includes(search)
      );
    }

    return projects;
  } catch (err) {
    console.error('Unexpected error in getAllProjects:', err);
    return [];
  }
}
