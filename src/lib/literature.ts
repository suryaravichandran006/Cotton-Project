export type LiteraturePaper = {
  id: string;
  theme: "Plant vision" | "Feature transfer" | "Cotton imaging";
  citation: string;
  year: number;
  title: string;
  venue: string;
  url: string;
  doi?: string;
  method: string;
  finding: string;
  connection: string;
};

export const LITERATURE: readonly LiteraturePaper[] = [
  {
    id: "mohanty-2016",
    theme: "Plant vision",
    citation: "Mohanty, Hughes & Salathé",
    year: 2016,
    title: "Using Deep Learning for Image-Based Plant Disease Detection",
    venue: "Frontiers in Plant Science",
    url: "https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2016.01419/full",
    doi: "10.3389/fpls.2016.01419",
    method: "Fine-tuned deep networks on 54,306 controlled leaf images spanning 38 crop-disease classes.",
    finding: "High held-out accuracy showed that transfer learning can separate plant conditions in controlled imagery.",
    connection: "Performance fell sharply on external images, making domain shift central to our staged cotton experiment.",
  },
  {
    id: "too-2019",
    theme: "Plant vision",
    citation: "Too, Li, Njuki & Liu",
    year: 2019,
    title: "A comparative study of fine-tuning deep learning models for plant disease identification",
    venue: "Computers and Electronics in Agriculture",
    url: "https://www.sciencedirect.com/science/article/pii/S0168169917313303",
    doi: "10.1016/j.compag.2018.03.032",
    method: "Compared fine-tuned VGG, Inception, ResNet and DenseNet models on PlantVillage.",
    finding: "DenseNet achieved the strongest reported dataset accuracy, supporting pretrained fine-tuning for plant imagery.",
    connection: "It compares backbones within one leaf domain; it does not test a cotton leaf-to-seed-to-fibre sequence.",
  },
  {
    id: "yosinski-2014",
    theme: "Feature transfer",
    citation: "Yosinski, Clune, Bengio & Lipson",
    year: 2014,
    title: "How transferable are features in deep neural networks?",
    venue: "NeurIPS",
    url: "https://proceedings.neurips.cc/paper_files/paper/2014/hash/532a2f85b6977104bc93f8580abbb330-Abstract.html",
    method: "Transferred layers between related and less-related source and target tasks.",
    finding: "Early features were more general while later features became task-specific; transfer weakened as tasks diverged.",
    connection: "This motivates retaining a learned backbone and replacing each temporary classifier head, while testing rather than assuming benefit.",
  },
  {
    id: "liu-2022",
    theme: "Feature transfer",
    citation: "Liu et al.",
    year: 2022,
    title: "A ConvNet for the 2020s",
    venue: "CVPR",
    url: "https://openaccess.thecvf.com/content/CVPR2022/html/Liu_A_ConvNet_for_the_2020s_CVPR_2022_paper.html",
    method: "Modernized a standard ConvNet through a controlled design progression inspired by vision transformers.",
    finding: "ConvNeXt remained a pure convolutional model while competing strongly across classification and downstream tasks.",
    connection: "It supports ConvNeXt-Tiny as our consistent backbone across all controlled transfer routes.",
  },
  {
    id: "du-2023",
    theme: "Cotton imaging",
    citation: "Du, Si, Li & Yun",
    year: 2023,
    title: "A method for detecting the quality of cotton seeds based on an improved ResNet50 model",
    venue: "PLOS ONE",
    url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0273057",
    doi: "10.1371/journal.pone.0273057",
    method: "Combined ResNet50 with attention to classify broken, cracked and intact cotton seeds.",
    finding: "The study reported strong cotton-seed quality classification and released a 450-image evaluation set.",
    connection: "It validates the seed task we reproduce, but studies seed condition rather than progressive cultivar transfer.",
  },
  {
    id: "rady-2025",
    theme: "Cotton imaging",
    citation: "Rady et al.",
    year: 2025,
    title: "Computer Vision and Transfer Learning for Grading of Egyptian Cotton Fibres",
    venue: "AgriEngineering",
    url: "https://www.mdpi.com/2624-7402/7/5/127",
    doi: "10.3390/agriengineering7050127",
    method: "Applied transfer learning to 3,447 cotton-fibre images across five Egyptian cultivars.",
    finding: "The work establishes RGB fibre imagery as a viable final cultivar-recognition domain.",
    connection: "It provides our candidate target dataset, but does not compare the exact leaf-to-seed-to-fibre progression.",
  },
] as const;

export const LITERATURE_THEMES = ["Plant vision", "Feature transfer", "Cotton imaging"] as const;
